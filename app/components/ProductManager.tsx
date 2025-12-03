'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase, Product, Brand } from '../../lib/supabase'
import { Plus, Edit, Trash2, Save, X, Package, Eye, FileText } from 'lucide-react'
import { getPhilippinesDate } from '../../lib/timezone'

interface ProductManagerProps {
  selectedBrand: Brand | null
  theme?: string
}

export function ProductManager({ selectedBrand, theme = 'blue' }: ProductManagerProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [newProduct, setNewProduct] = useState({
    name: '',
    sku: '',
    category: '',
    unit: 'pcs',
    price: 0,
    initial_stock: 0,
    production: 0,
    released: 0,
    reserved: 0
  })
  const [categories, setCategories] = useState<string[]>([])
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [fetchTimeout, setFetchTimeout] = useState<NodeJS.Timeout | null>(null)
  const [updateTimeout, setUpdateTimeout] = useState<NodeJS.Timeout | null>(null)
  const [productionInputMode, setProductionInputMode] = useState(false)
  const [productionValues, setProductionValues] = useState<{[productId: string]: number}>({})
  const [savingProduction, setSavingProduction] = useState(false)
  const [showProductionReports, setShowProductionReports] = useState(false)
  const [productionReports, setProductionReports] = useState<any[]>([])
  const [loadingReports, setLoadingReports] = useState(false)
  const [selectedReport, setSelectedReport] = useState<any | null>(null)
  const [deletingItem, setDeletingItem] = useState<string | null>(null)

  useEffect(() => {
    if (selectedBrand) {
      // Clear any existing timeout
      if (fetchTimeout) {
        clearTimeout(fetchTimeout)
      }
      
      // Set a new timeout to debounce the request
      const timeout = setTimeout(() => {
        fetchProducts()
      }, 100) // 100ms debounce
      
      setFetchTimeout(timeout)
    }
    
    // Cleanup timeout on unmount or dependency change
    return () => {
      if (fetchTimeout) {
        clearTimeout(fetchTimeout)
      }
      if (updateTimeout) {
        clearTimeout(updateTimeout)
      }
    }
  }, [selectedBrand])

  // Realtime subscription for products changes
  useEffect(() => {
    if (!selectedBrand) return

    const channel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'products',
          filter: `brand_id=eq.${selectedBrand.id}`
        },
        (payload) => {
          console.log('Products realtime update:', payload)
          
          // Only refetch if we're not currently editing
          // This prevents the realtime update from overwriting local edits
          if (!editingProduct) {
            fetchProducts()
          } else {
            console.log('Skipping realtime refetch - currently editing product')
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedBrand, editingProduct])

  useEffect(() => {
    // Extract unique categories from products
    const uniqueCategories = Array.from(new Set(products
      .map(p => p.category)
      .filter(cat => cat && cat.trim() !== '')
    )).sort()
    setCategories(uniqueCategories)
  }, [products])

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (showCategoryDropdown && !target.closest('.category-dropdown')) {
        setShowCategoryDropdown(false)
      }
    }

    if (showCategoryDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showCategoryDropdown])

  const getBrandPrefix = (brandSlug: string) => {
    switch (brandSlug) {
      case 'gelatofilipino':
        return 'GF-'
      case 'mychoice':
        return 'MC-'
      case 'mang-sorbetes':
        return 'MS-'
      default:
        return 'PR-'
    }
  }

  const generateNextSKU = useCallback(async (brandId: string) => {
    if (!selectedBrand) return ''

    try {
      // Use a more efficient query to get the highest SKU number
      const prefix = getBrandPrefix(selectedBrand.slug)
      
      // Query only SKUs that start with our prefix, ordered by SKU descending
      const { data, error } = await supabase
        .from('products')
        .select('sku')
        .eq('brand_id', brandId)
        .not('sku', 'is', null)
        .like('sku', `${prefix}%`)
        .order('sku', { ascending: false })
        .limit(1) // Only get the highest one

      if (error) {
        console.error('Error fetching products for SKU generation:', error)
        return prefix + '001'
      }

      let maxNumber = 0

      // Find the highest number in the returned SKU
      if (data && data.length > 0) {
        const sku = data[0].sku
        if (sku && sku.startsWith(prefix)) {
          const numberPart = sku.substring(prefix.length)
          const number = parseInt(numberPart)
          if (!isNaN(number)) {
            maxNumber = number
          }
        }
      }

      // Generate next SKU
      const nextNumber = maxNumber + 1
      return prefix + nextNumber.toString().padStart(3, '0')
    } catch (error) {
      console.error('Error generating SKU:', error)
      return getBrandPrefix(selectedBrand.slug) + '001'
    }
  }, [selectedBrand])

  const fetchProducts = async () => {
    if (!selectedBrand) return
    
    setLoading(true)
    
    try {
      console.log('Fetching products for brand:', selectedBrand.name)
      
      // Query products directly instead of using the view for better performance
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          brand_id,
          name,
          sku,
          category,
          unit,
          price,
          initial_stock,
          production,
          released,
          reserved,
          created_at,
          updated_at
        `)
        .eq('brand_id', selectedBrand.id)
        .order('name')
      
      if (error) {
        console.error('Error fetching products:', error)
        alert('Failed to load products. Please try refreshing the page.')
        return
      }
      
      if (data) {
        console.log('Products fetched successfully:', data.length, 'items')
        
        // Calculate computed fields on the client side for better performance
        const productsWithCalculations = data.map(product => ({
          ...product,
          product_name: product.name,
          brand_name: selectedBrand.name,
          brand_slug: selectedBrand.slug,
          final_stock: (product.initial_stock || 0) + (product.production || 0) - (product.released || 0),
          available_stock: (product.initial_stock || 0) + (product.production || 0) - (product.released || 0) - (product.reserved || 0)
        }))
        
        setProducts(productsWithCalculations)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
      alert('Failed to load products. Please check your internet connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  // Memoized grouped products calculation
  const groupedProducts = useMemo(() => {
    const grouped = products.reduce((acc, product) => {
      const category = product.category || 'Uncategorized'
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(product)
      return acc
    }, {} as Record<string, Product[]>)
    
    // Sort categories alphabetically, with 'Uncategorized' last
    const sortedCategories = Object.keys(grouped).sort((a, b) => {
      if (a === 'Uncategorized') return 1
      if (b === 'Uncategorized') return -1
      return a.localeCompare(b)
    })
    
    return sortedCategories.map(category => ({
      category,
      products: grouped[category]
    }))
  }, [products])

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBrand) return

    try {
      const { data, error } = await supabase
        .from('products')
        .insert([
          {
            brand_id: selectedBrand.id,
            name: newProduct.name,
            sku: newProduct.sku || null,
            category: newProduct.category || null,
            unit: newProduct.unit,
            price: newProduct.price,
            initial_stock: newProduct.initial_stock,
            production: newProduct.production,
            released: newProduct.released,
            reserved: newProduct.reserved
          }
        ])
        .select()

      if (error) {
        console.error('Error adding product:', error)
        alert('Error adding product: ' + error.message)
        return
      }

      if (data && data[0]) {
        // Optimistic UI update - add the new product to state immediately
        const newProductData = data[0]
        const computedProduct = {
          ...newProductData,
          product_id: newProductData.id,
          product_name: newProductData.name,
          final_stock: (newProductData.initial_stock || 0) + (newProductData.production || 0) - (newProductData.released || 0),
          available_stock: (newProductData.initial_stock || 0) + (newProductData.production || 0) - (newProductData.released || 0) - (newProductData.reserved || 0)
        }
        setProducts(prev => [...prev, computedProduct])
        setNewProduct({ name: '', sku: '', category: '', unit: 'pcs', price: 0, initial_stock: 0, production: 0, released: 0, reserved: 0 })
        setShowAddForm(false)
      }
    } catch (error) {
      console.error('Error adding product:', error)
      alert('Error adding product')
    }
  }

  const handleUpdateProduct = useCallback(async (product: Product) => {
    // Clear any existing timeout
    if (updateTimeout) {
      clearTimeout(updateTimeout)
    }
    
    // Debounce the update to prevent excessive API calls
    const timeout = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .update({
            name: product.name,
            sku: product.sku,
            category: product.category,
            unit: product.unit,
            price: product.price,
            initial_stock: product.initial_stock,
            production: product.production,
            released: product.released,
            reserved: product.reserved
          })
          .eq('id', product.id)
          .select()

        if (error) {
          console.error('Error updating product:', error)
          alert('Error updating product: ' + error.message)
          return
        }

        if (data) {
          // Update local state immediately for better UX
          setProducts(prev => prev.map(p => 
            p.id === product.id 
              ? {
                  ...p,
                  ...product,
                  product_name: product.name,
                  final_stock: (product.initial_stock || 0) + (product.production || 0) - (product.released || 0),
                  available_stock: (product.initial_stock || 0) + (product.production || 0) - (product.released || 0) - (product.reserved || 0)
                }
              : p
          ))
          setEditingProduct(null)
        }
      } catch (error) {
        console.error('Error updating product:', error)
        alert('Error updating product')
      }
    }, 500) // 500ms debounce
    
    setUpdateTimeout(timeout)
  }, [updateTimeout])

  const handleSaveAllProduction = async () => {
    if (!selectedBrand) return

    setSavingProduction(true)
    try {
      // First, fetch current product data to get initial_stock values
      const productIds = Object.keys(productionValues)
      const { data: currentProducts, error: fetchError } = await supabase
        .from('products')
        .select('id, initial_stock, production')
        .in('id', productIds)

      if (fetchError) throw fetchError

      const currentProductsMap = new Map(
        currentProducts?.map(p => [p.id, p]) || []
      )

      // Get today's date in Philippines timezone
      const today = getPhilippinesDate()

      // Calculate totals for daily summary
      const totalProduction = Object.values(productionValues).reduce((sum, val) => sum + (val || 0), 0)
      
      // Get product names for production details
      const { data: allProductsData } = await supabase
        .from('products')
        .select('id, name')
        .eq('brand_id', selectedBrand.id)

      // Build production details array with product names and quantities
      // Use products from state first (they have product_id or id), then fall back to fetched data
      const productionDetails = Object.entries(productionValues)
        .filter(([_, value]) => value > 0) // Only include products with production > 0
        .map(([productId, productionValue]) => {
          // First try to find in current products state
          const productFromState = products.find(p => {
            const pId = p.product_id || p.id
            return pId === productId
          })
          
          // If not found in state, try fetched data
          const productFromFetched = allProductsData?.find(p => p.id === productId)
          
          // Get product name from state or fetched data
          const productName = productFromState?.name || productFromState?.product_name || productFromFetched?.name || 'Unknown Product'
          
          return {
            product_id: productId,
            product_name: productName,
            production: productionValue || 0
          }
        })

      // Update all products: add production to initial_stock and reset production to 0
      const updatePromises = Object.entries(productionValues).map(async ([productId, productionValue]) => {
        const currentProduct = currentProductsMap.get(productId)
        if (!currentProduct) return

        const newInitialStock = (currentProduct.initial_stock || 0) + (productionValue || 0)

        const { error } = await supabase
          .from('products')
          .update({
            initial_stock: newInitialStock,
            production: 0, // Reset production after adding to initial stock
            updated_at: new Date().toISOString()
          })
          .eq('id', productId)

        if (error) {
          console.error(`Error updating product ${productId}:`, error)
          throw error
        }
      })

      await Promise.all(updatePromises)

      // Save or update daily production report
      const { data: existingReport, error: checkError } = await supabase
        .from('daily_stock_summaries')
        .select('id')
        .eq('brand_id', selectedBrand.id)
        .eq('date', today)
        .maybeSingle()

      // Check if error is something other than "no rows found"
      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking for existing report:', checkError)
        // Don't throw - production was already saved
      } else if (existingReport && existingReport.id) {
        // Update existing report - merge production details
        const { data: existingReportData } = await supabase
          .from('daily_stock_summaries')
          .select('production_details')
          .eq('id', existingReport.id)
          .maybeSingle()

        const existingDetails = (existingReportData?.production_details && Array.isArray(existingReportData.production_details)) 
          ? existingReportData.production_details 
          : []
        const mergedDetails = [...existingDetails, ...productionDetails]

        const { error: updateReportError } = await supabase
          .from('daily_stock_summaries')
          .update({
            total_production: totalProduction,
            production_details: mergedDetails
          })
          .eq('id', existingReport.id)

        if (updateReportError) {
          console.error('Error updating daily report:', updateReportError)
          // Don't throw - production was already saved
        }
      } else {
        // Create new report
        const { error: createReportError } = await supabase
          .from('daily_stock_summaries')
          .insert({
            brand_id: selectedBrand.id,
            date: today,
            total_production: totalProduction,
            production_details: productionDetails
          })

        if (createReportError) {
          console.error('Error creating daily report:', createReportError)
          // Don't throw - production was already saved
        }
      }

      // Refresh products to show updated values
      await fetchProducts()

      // Exit production input mode
      setProductionInputMode(false)
      setProductionValues({})

      alert('Production values added to initial stock and saved to daily report successfully!')
    } catch (error) {
      console.error('Error saving production values:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      alert(`Failed to save production values: ${errorMessage}. Please try again.`)
    } finally {
      setSavingProduction(false)
    }
  }

  const fetchProductionReports = async () => {
    if (!selectedBrand) return

    setLoadingReports(true)
    try {
      const { data, error } = await supabase
        .from('daily_stock_summaries')
        .select('*')
        .eq('brand_id', selectedBrand.id)
        .order('date', { ascending: false })
        .limit(30)

      if (error) throw error

      setProductionReports(data || [])
    } catch (error) {
      console.error('Error fetching production reports:', error)
      alert('Failed to fetch production reports')
    } finally {
      setLoadingReports(false)
    }
  }

  const handleDeleteProductionItem = async (reportId: string, itemIndex: number) => {
    if (!selectedReport || !confirm('Are you sure you want to delete this item from the production report?')) {
      return
    }

    setDeletingItem(`${reportId}-${itemIndex}`)
    try {
      const currentDetails = Array.isArray(selectedReport.production_details) 
        ? selectedReport.production_details 
        : []
      
      // Remove the item at the specified index
      const updatedDetails = currentDetails.filter((_: any, index: number) => index !== itemIndex)
      
      // Recalculate total production
      const newTotalProduction = updatedDetails.reduce((sum: number, item: any) => sum + (item.production || 0), 0)

      // Update the report in the database
      const { error } = await supabase
        .from('daily_stock_summaries')
        .update({
          total_production: newTotalProduction,
          production_details: updatedDetails
        })
        .eq('id', reportId)

      if (error) throw error

      // Update the selected report in state
      setSelectedReport({
        ...selectedReport,
        total_production: newTotalProduction,
        production_details: updatedDetails
      })

      // Update the report in the reports list
      setProductionReports(prevReports => 
        prevReports.map(report => 
          report.id === reportId 
            ? { ...report, total_production: newTotalProduction, production_details: updatedDetails }
            : report
        )
      )

      alert('Item deleted successfully!')
    } catch (error) {
      console.error('Error deleting production item:', error)
      alert('Failed to delete item. Please try again.')
    } finally {
      setDeletingItem(null)
    }
  }

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return

    // Optimistic UI update - remove product immediately
    const previousProducts = products
    setProducts(products.filter(p => (p.product_id || p.id) !== productId))

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)

      if (error) {
        console.error('Error deleting product:', error)
        alert('Error deleting product: ' + error.message)
        // Revert optimistic update on error
        setProducts(previousProducts)
        return
      }

      console.log('Product deleted successfully')
    } catch (error) {
      console.error('Error deleting product:', error)
      alert('Error deleting product')
      // Revert optimistic update on error
      setProducts(previousProducts)
    }
  }


  if (!selectedBrand) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Please select a brand to manage products</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Inventory
          </h1>
          <p className="text-sm text-gray-600">
            Manage finished goods and stock levels for {selectedBrand.name}
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => {
              if (productionInputMode) {
                // Cancel production input mode
                setProductionInputMode(false)
                setProductionValues({})
              } else {
                // Enter production input mode - initialize with current production values
                const initialValues: {[productId: string]: number} = {}
                products.forEach(product => {
                  const productId = product.product_id || product.id
                  initialValues[productId] = product.production || 0
                })
                setProductionValues(initialValues)
                setProductionInputMode(true)
              }
            }}
            className={`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors ${
              productionInputMode
                ? 'bg-gray-600 hover:bg-gray-700'
                : 'bg-orange-600 hover:bg-orange-700'
            }`}
          >
            <Package className="h-4 w-4" />
            <span>{productionInputMode ? 'Cancel' : 'Production'}</span>
          </button>
          {productionInputMode && (
            <button
              onClick={handleSaveAllProduction}
              disabled={savingProduction}
              className={`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors ${
                theme === 'green' ? 'bg-green-600 hover:bg-green-700' :
                theme === 'red' ? 'bg-red-600 hover:bg-red-700' :
                theme === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-700' :
                'bg-blue-600 hover:bg-blue-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Save className="h-4 w-4" />
              <span>{savingProduction ? 'Saving...' : 'Save All Production'}</span>
            </button>
          )}
          <button
            onClick={() => {
              setShowProductionReports(true)
              fetchProductionReports()
            }}
            className="flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors bg-purple-600 hover:bg-purple-700"
          >
            <FileText className="h-4 w-4" />
            <span>Production Log</span>
          </button>
          <button
            onClick={async () => {
              const nextSKU = await generateNextSKU(selectedBrand.id)
              setNewProduct({
                ...newProduct,
                sku: nextSKU
              })
              setShowAddForm(true)
            }}
            className={`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors ${
              theme === 'green' ? 'bg-green-600 hover:bg-green-700' :
              theme === 'red' ? 'bg-red-600 hover:bg-red-700' :
              theme === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-700' :
              'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <Plus className="h-4 w-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add New Product</h3>
              <button
                onClick={() => {
                  setShowAddForm(false)
                  setNewProduct({ name: '', sku: '', category: '', unit: 'pcs', price: 0, initial_stock: 0, production: 0, released: 0, reserved: 0 })
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter product name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SKU (Auto-generated)
                  </label>
                  <input
                    type="text"
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({...newProduct, sku: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                    placeholder="Auto-generated SKU"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    SKU format: {getBrandPrefix(selectedBrand.slug)}XXX (e.g., {getBrandPrefix(selectedBrand.slug)}001)
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <div className="relative category-dropdown">
                    <input
                      type="text"
                      value={newProduct.category}
                      onChange={(e) => {
                        setNewProduct({...newProduct, category: e.target.value})
                        setShowCategoryDropdown(true)
                      }}
                      onFocus={() => setShowCategoryDropdown(true)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter or select category"
                    />
                    {showCategoryDropdown && categories.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {categories.map((category) => (
                          <button
                            key={category}
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setNewProduct({...newProduct, category})
                              setShowCategoryDropdown(false)
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm text-gray-900"
                          >
                            {category}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* Initial Stock, Unit, and Price in same row */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Initial Stock
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newProduct.initial_stock}
                      onChange={(e) => setNewProduct({...newProduct, initial_stock: parseInt(e.target.value) || 0})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit
                    </label>
                    <select
                      value={newProduct.unit}
                      onChange={(e) => setNewProduct({...newProduct, unit: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="pans">Pans</option>
                      <option value="pcs">Pieces</option>
                      <option value="gallons">Gallons</option>
                      <option value="liters">Liters</option>
                      <option value="kg">Kilograms</option>
                      <option value="boxes">Boxes</option>
                      <option value="bags">Bags</option>
                      <option value="g">Grams</option>
                      <option value="bottles">Bottles</option>
                      <option value="packs">Packs</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Price (₱)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newProduct.price}
                      onChange={(e) => setNewProduct({...newProduct, price: parseFloat(e.target.value) || 0})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false)
                    setNewProduct({ name: '', sku: '', category: '', unit: 'pcs', price: 0, initial_stock: 0, production: 0, released: 0, reserved: 0 })
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors ${
                    theme === 'green' ? 'bg-green-600 hover:bg-green-700' :
                    theme === 'red' ? 'bg-red-600 hover:bg-red-700' :
                    theme === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-700' :
                    'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  <Save className="h-4 w-4" />
                  <span>Save Product</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Products List */}
      {loading ? (
        <div className="space-y-6">
          {/* Skeleton for each category */}
          {[...Array(2)].map((_, categoryIndex) => (
            <div key={categoryIndex} className="bg-white rounded-lg border shadow-sm overflow-hidden">
              {/* Category header skeleton */}
              <div className="bg-gray-50 px-6 py-3 border-b">
                <div className="animate-pulse">
                  <div className="h-6 bg-gray-200 rounded w-48"></div>
                </div>
              </div>
              
              {/* Table skeleton */}
              <div>
                <table className="w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {[...Array(11)].map((_, i) => (
                        <th key={i} className="px-6 py-3 text-left">
                          <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {[...Array(3)].map((_, rowIndex) => (
                      <tr key={rowIndex}>
                        {[...Array(11)].map((_, cellIndex) => (
                          <td key={cellIndex} className="px-6 py-2 whitespace-nowrap">
                            <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No products found for {selectedBrand.name}</p>
          <p className="text-sm">Click "Add Product" to create your first product</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedProducts.map(({ category, products: categoryProducts }) => (
            <div key={category} className="bg-white rounded-lg border shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200 ease-in-out">
              <div className="bg-gray-50 px-6 py-3 border-b hover:bg-gray-100 transition-colors duration-200 ease-in-out">
                <h3 className="text-lg font-medium text-gray-900">
                  {category} ({categoryProducts.length} {categoryProducts.length === 1 ? 'product' : 'products'})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                    Product Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    SKU
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Unit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Initial Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Prod
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Rel
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Final Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Res
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Available
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {categoryProducts.map((product) => (
                  <tr key={product.product_id || product.id} className="hover:bg-blue-100">
                    <td className="px-6 py-2 h-10 whitespace-nowrap text-sm font-medium text-gray-900">
                      {editingProduct?.id === (product.product_id || product.id) ? (
                        <input
                          type="text"
                          value={editingProduct.name}
                          onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})}
                          className="w-full max-w-44 px-2 h-6 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        product.product_name || product.name
                      )}
                    </td>
                    <td className="px-6 py-2 h-10 whitespace-nowrap text-sm text-gray-500">
                      {editingProduct?.id === (product.product_id || product.id) ? (
                        <input
                          type="text"
                          value={editingProduct.sku || ''}
                          onChange={(e) => setEditingProduct({...editingProduct, sku: e.target.value})}
                          className="w-full max-w-28 px-2 h-6 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        product.sku || '-'
                      )}
                    </td>
                    <td className="px-6 py-2 h-10 whitespace-nowrap text-sm text-gray-500">
                      {editingProduct?.id === (product.product_id || product.id) ? (
                        <select
                          value={editingProduct.unit}
                          onChange={(e) => setEditingProduct({...editingProduct, unit: e.target.value})}
                          className="w-full max-w-20 px-2 h-6 border border-gray-300 rounded text-sm"
                        >
                          <option value="pans">Pans</option>
                          <option value="pcs">Pieces</option>
                          <option value="gallons">Gallons</option>
                          <option value="liters">Liters</option>
                          <option value="kg">Kilograms</option>
                          <option value="boxes">Boxes</option>
                          <option value="bags">Bags</option>
                          <option value="g">Grams</option>
                          <option value="bottles">Bottles</option>
                          <option value="packs">Packs</option>
                        </select>
                      ) : (
                        product.unit
                      )}
                    </td>
                    <td className="px-6 py-2 h-10 whitespace-nowrap text-sm font-medium text-green-600">
                      {editingProduct?.id === (product.product_id || product.id) ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editingProduct.price === 0 ? '' : editingProduct.price || ''}
                          onChange={(e) => setEditingProduct({...editingProduct, price: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0})}
                          className="w-full max-w-20 px-2 h-6 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                      ) : (
                        `₱${(product.price || 0).toFixed(2)}`
                      )}
                    </td>
                    <td className="px-6 py-2 h-10 whitespace-nowrap text-sm text-gray-900">
                      {editingProduct?.id === (product.product_id || product.id) ? (
                        <input
                          type="number"
                          min="0"
                          value={editingProduct.initial_stock === 0 ? '' : editingProduct.initial_stock || ''}
                          onChange={(e) => setEditingProduct({...editingProduct, initial_stock: e.target.value === '' ? 0 : parseInt(e.target.value) || 0})}
                          className="w-full max-w-16 px-2 h-6 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                      ) : (
                        product.initial_stock || 0
                      )}
                    </td>
                    <td className="px-6 py-2 h-10 whitespace-nowrap text-sm text-gray-900">
                      {productionInputMode ? (
                        <input
                          type="number"
                          min="0"
                          value={productionValues[product.product_id || product.id] === 0 ? '' : productionValues[product.product_id || product.id] || ''}
                          onChange={(e) => {
                            const productId = product.product_id || product.id
                            setProductionValues({
                              ...productionValues,
                              [productId]: e.target.value === '' ? 0 : parseInt(e.target.value) || 0
                            })
                          }}
                          className="w-full max-w-16 px-2 h-6 border-2 border-blue-400 rounded text-sm text-center bg-blue-50 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                      ) : editingProduct?.id === (product.product_id || product.id) ? (
                        <input
                          type="number"
                          min="0"
                          value={editingProduct.production === 0 ? '' : editingProduct.production || ''}
                          onChange={(e) => setEditingProduct({...editingProduct, production: e.target.value === '' ? 0 : parseInt(e.target.value) || 0})}
                          className="w-full max-w-16 px-2 h-6 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                      ) : (
                        product.production || 0
                      )}
                    </td>
                    <td className="px-6 py-2 h-10 whitespace-nowrap text-sm text-gray-900">
                      {editingProduct?.id === (product.product_id || product.id) ? (
                        <input
                          type="number"
                          min="0"
                          value={editingProduct.released === 0 ? '' : editingProduct.released || ''}
                          onChange={(e) => setEditingProduct({...editingProduct, released: e.target.value === '' ? 0 : parseInt(e.target.value) || 0})}
                          className="w-full max-w-16 px-2 h-6 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                      ) : (
                        product.released || 0
                      )}
                    </td>
                    <td className="px-6 py-2 h-10 whitespace-nowrap text-sm font-semibold text-purple-600">
                      {productionInputMode ? (
                        (product.initial_stock || 0) + (productionValues[product.product_id || product.id] || product.production || 0) - (product.released || 0)
                      ) : editingProduct?.id === (product.product_id || product.id) ? (
                        (editingProduct.initial_stock || 0) + (editingProduct.production || 0) - (editingProduct.released || 0)
                      ) : (
                        product.final_stock || 0
                      )}
                    </td>
                    <td className="px-6 py-2 h-10 whitespace-nowrap text-sm text-gray-900">
                      {editingProduct?.id === (product.product_id || product.id) ? (
                        <input
                          type="number"
                          min="0"
                          value={editingProduct.reserved === 0 ? '' : editingProduct.reserved || ''}
                          onChange={(e) => setEditingProduct({...editingProduct, reserved: e.target.value === '' ? 0 : parseInt(e.target.value) || 0})}
                          className="w-full max-w-16 px-2 h-6 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                      ) : (
                        product.reserved || 0
                      )}
                    </td>
                    <td className="px-6 py-2 h-10 whitespace-nowrap text-sm font-semibold text-emerald-600">
                      {productionInputMode ? (
                        ((product.initial_stock || 0) + (productionValues[product.product_id || product.id] || product.production || 0) - (product.released || 0)) - (product.reserved || 0)
                      ) : editingProduct?.id === (product.product_id || product.id) ? (
                        ((editingProduct.initial_stock || 0) + (editingProduct.production || 0) - (editingProduct.released || 0)) - (editingProduct.reserved || 0)
                      ) : (
                        product.available_stock || 0
                      )}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-2">
                        {editingProduct?.id === (product.product_id || product.id) ? (
                          <>
                            <button
                              onClick={() => handleUpdateProduct(editingProduct)}
                              className={`p-1 rounded ${
                                theme === 'green' ? 'text-green-600 hover:text-green-900 hover:bg-green-100' :
                                theme === 'red' ? 'text-red-600 hover:text-red-900 hover:bg-red-100' :
                                theme === 'yellow' ? 'text-yellow-600 hover:text-yellow-900 hover:bg-yellow-100' :
                                'text-blue-600 hover:text-blue-900 hover:bg-blue-100'
                              }`}
                              title="Save"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setEditingProduct(null)}
                              className="p-1 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-200"
                              title="Cancel"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => setEditingProduct({
                                ...product, 
                                id: product.product_id || product.id,
                                name: product.product_name || product.name
                              })}
                              className={`p-1 rounded ${
                                theme === 'green' ? 'text-green-600 hover:text-green-900 hover:bg-green-100' :
                                theme === 'red' ? 'text-red-600 hover:text-red-900 hover:bg-red-100' :
                                theme === 'yellow' ? 'text-yellow-600 hover:text-yellow-900 hover:bg-yellow-100' :
                                'text-blue-600 hover:text-blue-900 hover:bg-blue-100'
                              }`}
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(product.product_id || product.id)}
                              className="p-1 rounded text-red-600 hover:text-red-900 hover:bg-red-100"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Production Reports Modal */}
      {showProductionReports && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-2/3 lg:w-1/2 shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Daily Production Reports</h3>
              <button
                onClick={() => {
                  setShowProductionReports(false)
                  setSelectedReport(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {loadingReports ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                <p className="mt-2 text-gray-600">Loading reports...</p>
              </div>
            ) : productionReports.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No production reports found</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Production</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {productionReports.map((report) => (
                        <tr key={report.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(report.date).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {report.total_production || 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button
                              onClick={() => setSelectedReport(report)}
                              className="text-blue-600 hover:text-blue-900 flex items-center space-x-1"
                            >
                              <Eye className="h-4 w-4" />
                              <span>View Details</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Report Details Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Production Report - {new Date(selectedReport.date).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </h3>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Total Production</p>
                <p className="text-2xl font-semibold text-gray-900">{selectedReport.total_production || 0}</p>
              </div>

              {/* Production Details List */}
              {selectedReport.production_details && Array.isArray(selectedReport.production_details) && selectedReport.production_details.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Production Items</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Production Quantity</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedReport.production_details.map((item: any, index: number) => (
                          <tr key={item.product_id || index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.product_name || 'Unknown Product'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.production || 0}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <button
                                onClick={() => handleDeleteProductionItem(selectedReport.id, index)}
                                disabled={deletingItem === `${selectedReport.id}-${index}`}
                                className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                                title="Delete item"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span>{deletingItem === `${selectedReport.id}-${index}` ? 'Deleting...' : 'Delete'}</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-600">
                  <strong>Created:</strong> {new Date(selectedReport.created_at).toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
