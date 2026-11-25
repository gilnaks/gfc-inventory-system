export type RecipeMethod = 'mix' | 'blend' | 'machine' | 'drizzle' | 'fold'

export type MethodDefinition = {
  method: RecipeMethod
  label: string
  description: string
}

export type BaseIngredient = {
  quantity: string
  name: string
}

export type IngredientStep = {
  kind: 'ingredient'
  quantity: string | null
  name: string
  method: RecipeMethod
}

export type ActionStep = {
  kind: 'action'
  label: string
}

export type RecipeStep = IngredientStep | ActionStep

export type FlavorRecipe = {
  name: string
  steps: RecipeStep[]
}

export type RecipeBook = {
  brand: string
  slug: string
  yieldLabel: string
  baseNote: string
  methods: MethodDefinition[]
  base: {
    name: string
    method: RecipeMethod
    ingredients: BaseIngredient[]
  }
  flavors: FlavorRecipe[]
}
