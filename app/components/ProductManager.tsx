'use client'
import { useState, useEffect } from 'react'
import { supabase, Product, Brand } from '../../lib/supabase'
import { Plus, Edit, Trash2, Save, X, CheckCircle } from 'lucide-react'
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

  useEffect(() => {
    if (selectedBrand) {
      fetchProducts()
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

  const generateNextSKU = async (brandId: string) => {
    if (!selectedBrand) return ''

    try {
      // Fetch all products for this brand to find the highest SKU number
      const { data, error } = await supabase
        .from('products')
        .select('sku')
        .eq('brand_id', brandId)
        .not('sku', 'is', null)

      if (error) {
        console.error('Error fetching products for SKU generation:', error)
        return getBrandPrefix(selectedBrand.slug) + '001'
      }

      const prefix = getBrandPrefix(selectedBrand.slug)
      let maxNumber = 0

      // Find the highest number in existing SKUs
      if (data && data.length > 0) {
        data.forEach(product => {
          if (product.sku && product.sku.startsWith(prefix)) {
            const numberPart = product.sku.substring(prefix.length)
            const number = parseInt(numberPart)
            if (!isNaN(number) && number > maxNumber) {
              maxNumber = number
            }
          }
        })
      }

      // Generate next SKU
      const nextNumber = maxNumber + 1
      return prefix + nextNumber.toString().padStart(3, '0')
    } catch (error) {
      console.error('Error generating SKU:', error)
      return getBrandPrefix(selectedBrand.slug) + '001'
    }
  }

  const fetchProducts = async () => {
    if (!selectedBrand) return
    
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('inventory_summary')
        .select('*')
        .eq('brand_id', selectedBrand.id)
        .order('product_name')
      
      if (error) {
        console.error('Error fetching products:', error)
        return
      }
      
      if (data) {
        setProducts(data)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const groupProductsByCategory = (products: Product[]) => {
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
  }

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

      if (data) {
        // Manually refetch products to get the new product with computed values from inventory_summary view
        await fetchProducts()
        setNewProduct({ name: '', sku: '', category: '', unit: 'pcs', price: 0, initial_stock: 0, production: 0, released: 0, reserved: 0 })
        setShowAddForm(false)
      }
    } catch (error) {
      console.error('Error adding product:', error)
      alert('Error adding product')
    }
  }

  const handleUpdateProduct = async (product: Product) => {
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
        // Manually refetch products to get updated computed values from inventory_summary view
        await fetchProducts()
        setEditingProduct(null)
      }
    } catch (error) {
      console.error('Error updating product:', error)
      alert('Error updating product')
    }
  }

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)

      if (error) {
        console.error('Error deleting product:', error)
        alert('Error deleting product: ' + error.message)
        return
      }

      console.log('Product deleted successfully')
      
      // Immediately update the local state for instant UI feedback
      setProducts(products.filter(p => (p.product_id || p.id) !== productId))
      
      // Also refetch to ensure we have the latest data from the database
      // This handles any edge cases where the local filter might miss something
      setTimeout(async () => {
        console.log('Refetching products to ensure consistency')
        await fetchProducts()
      }, 500)
    } catch (error) {
      console.error('Error deleting product:', error)
      alert('Error deleting product')
    }
  }

  const handleFinalizeStock = async () => {
    if (!selectedBrand) return

    // Require password
    const password = prompt('Please enter Wendy\'s birthdate to finalize stock:')
    if (password !== '030199') {
      alert('Invalid birthdate. Stock finalization cancelled.')
      return
    }

    if (!confirm('Are you sure you want to finalize the stock? This will move final stock to initial stock and clear production/released quantities for all products.')) {
      return
    }

    try {
      // First, get all products for the current brand
      const { data: allProducts, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('brand_id', selectedBrand.id)

      if (fetchError) {
        console.error('Error fetching products:', fetchError)
        alert('Error fetching products for finalization')
        return
      }

      if (!allProducts || allProducts.length === 0) {
        alert('No products found to finalize')
        return
      }

      // Create daily summary record first
      const { data: summaryData, error: summaryError } = await supabase
        .from('daily_stock_summaries')
        .insert({
          brand_id: selectedBrand.id,
          date: getPhilippinesDate(), // YYYY-MM-DD format in Philippines timezone
          total_production: allProducts.reduce((sum, p) => sum + (p.production || 0), 0),
          total_released: allProducts.reduce((sum, p) => sum + (p.released || 0), 0),
          total_final_stock: allProducts.reduce((sum, p) => sum + (p.initial_stock || 0) + (p.production || 0) - (p.released || 0), 0)
        })
        .select()
        .single()

      if (summaryError) {
        console.error('Error creating daily summary:', summaryError)
        alert('Error creating daily summary')
        return
      }

      // Update each product: move final stock to initial stock, clear production and released
      for (const product of allProducts) {
        const finalStock = (product.initial_stock || 0) + (product.production || 0) - (product.released || 0)
        
        const { error: updateError } = await supabase
          .from('products')
          .update({
            initial_stock: finalStock,
            production: 0,
            released: 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', product.id)

        if (updateError) {
          console.error(`Error updating product ${product.name}:`, updateError)
          alert(`Error updating product ${product.name}`)
          return
        }
      }

      alert('Stock finalized successfully! All products have been updated for the next day.')
      
      // Refresh the products list
      await fetchProducts()
      
    } catch (error) {
      console.error('Error finalizing stock:', error)
      alert('Error finalizing stock')
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
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-gray-900">
          Products for {selectedBrand.name}
        </h3>
        <div className="flex space-x-3">
          <button
            onClick={handleFinalizeStock}
            className={`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors ${
              theme === 'green' ? 'bg-orange-600 hover:bg-orange-700' :
              theme === 'red' ? 'bg-orange-600 hover:bg-orange-700' :
              theme === 'yellow' ? 'bg-orange-600 hover:bg-orange-700' :
              'bg-orange-600 hover:bg-orange-700'
            }`}
          >
            <CheckCircle className="h-4 w-4" />
            <span>Finalize Stock</span>
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
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
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
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading products...</span>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No products found for {selectedBrand.name}</p>
          <p className="text-sm">Click "Add Product" to create your first product</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupProductsByCategory(products).map(({ category, products: categoryProducts }) => (
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
                    <td className="px-6 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                      {editingProduct?.id === (product.product_id || product.id) ? (
                        <input
                          type="text"
                          value={editingProduct.name}
                          onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})}
                          className="w-full max-w-44 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        product.product_name || product.name
                      )}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                      {editingProduct?.id === (product.product_id || product.id) ? (
                        <input
                          type="text"
                          value={editingProduct.sku || ''}
                          onChange={(e) => setEditingProduct({...editingProduct, sku: e.target.value})}
                          className="w-full max-w-28 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        product.sku || '-'
                      )}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                      {editingProduct?.id === (product.product_id || product.id) ? (
                        <select
                          value={editingProduct.unit}
                          onChange={(e) => setEditingProduct({...editingProduct, unit: e.target.value})}
                          className="w-full max-w-20 px-2 py-1 border border-gray-300 rounded text-sm"
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
                    <td className="px-6 py-2 whitespace-nowrap text-sm font-medium text-green-600">
                      {editingProduct?.id === (product.product_id || product.id) ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editingProduct.price || 0}
                          onChange={(e) => setEditingProduct({...editingProduct, price: parseFloat(e.target.value) || 0})}
                          className="w-full max-w-20 px-2 py-1 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                      ) : (
                        `₱${(product.price || 0).toFixed(2)}`
                      )}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900">
                      {editingProduct?.id === (product.product_id || product.id) ? (
                        <input
                          type="number"
                          min="0"
                          value={editingProduct.initial_stock || 0}
                          onChange={(e) => setEditingProduct({...editingProduct, initial_stock: parseInt(e.target.value) || 0})}
                          className="w-full max-w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                      ) : (
                        product.initial_stock || 0
                      )}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900">
                      {editingProduct?.id === (product.product_id || product.id) ? (
                        <input
                          type="number"
                          min="0"
                          value={editingProduct.production || 0}
                          onChange={(e) => setEditingProduct({...editingProduct, production: parseInt(e.target.value) || 0})}
                          className="w-full max-w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                      ) : (
                        product.production || 0
                      )}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900">
                      {editingProduct?.id === (product.product_id || product.id) ? (
                        <input
                          type="number"
                          min="0"
                          value={editingProduct.released || 0}
                          onChange={(e) => setEditingProduct({...editingProduct, released: parseInt(e.target.value) || 0})}
                          className="w-full max-w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                      ) : (
                        product.released || 0
                      )}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm font-semibold text-purple-600">
                      {editingProduct?.id === (product.product_id || product.id)
                        ? (editingProduct.initial_stock || 0) + (editingProduct.production || 0) - (editingProduct.released || 0)
                        : product.final_stock || 0
                      }
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900">
                      {editingProduct?.id === (product.product_id || product.id) ? (
                        <input
                          type="number"
                          min="0"
                          value={editingProduct.reserved || 0}
                          onChange={(e) => setEditingProduct({...editingProduct, reserved: parseInt(e.target.value) || 0})}
                          className="w-full max-w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                      ) : (
                        product.reserved || 0
                      )}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm font-semibold text-emerald-600">
                      {editingProduct?.id === (product.product_id || product.id)
                        ? ((editingProduct.initial_stock || 0) + (editingProduct.production || 0) - (editingProduct.released || 0)) - (editingProduct.reserved || 0)
                        : product.available_stock || 0
                      }
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
    </div>
  )
}
