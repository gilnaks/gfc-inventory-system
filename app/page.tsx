'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Package, ShoppingCart, ArrowRight } from 'lucide-react'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to dashboard after a short delay
    const timer = setTimeout(() => {
      router.push('/dashboard')
    }, 3000)

    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        {/* Header */}
        <div className="mb-12">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-6">
            <Package className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            GFC Portal
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Complete inventory and order management solution
          </p>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Admin Dashboard */}
          <div className="bg-white rounded-lg shadow-md border p-8 hover:shadow-lg transition-shadow">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Admin Dashboard</h2>
            <p className="text-gray-600 mb-6">
              Manage inventory, products, and customer orders
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <span>Access Dashboard</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* Customer Orders */}
          <div className="bg-white rounded-lg shadow-md border p-8 hover:shadow-lg transition-shadow">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <ShoppingCart className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Place Order</h2>
            <p className="text-gray-600 mb-6">
              Customer order form with location-based access
            </p>
            <button
              onClick={() => router.push('/order')}
              className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <span>Place Order</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Auto-redirect notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800">
            <strong>Auto-redirecting to dashboard in 3 seconds...</strong>
          </p>
          <p className="text-blue-600 text-sm mt-1">
            Or click the buttons above to navigate manually
          </p>
        </div>

        {/* Features */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-8 w-8 rounded-full bg-purple-100 mb-3">
              <Package className="h-4 w-4 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Inventory Management</h3>
            <p className="text-sm text-gray-600">Track stock levels across multiple brands</p>
          </div>
          
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-8 w-8 rounded-full bg-orange-100 mb-3">
              <ShoppingCart className="h-4 w-4 text-orange-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Order Processing</h3>
            <p className="text-sm text-gray-600">Manage customer orders and fulfillment</p>
          </div>
          
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-8 w-8 rounded-full bg-green-100 mb-3">
              <ArrowRight className="h-4 w-4 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Real-time Updates</h3>
            <p className="text-sm text-gray-600">Live inventory calculations and status updates</p>
          </div>
        </div>
      </div>
    </div>
  )
}
