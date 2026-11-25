import type { Metadata } from 'next'
import { myChoiceRecipes } from '../../../lib/recipes/mychoice'
import { RecipeBook } from './RecipeBook'

export const metadata: Metadata = {
  title: 'MyChoice Recipes',
  description: 'MyChoice ice cream recipes. 1 pan per batch.',
}

export default function MyChoiceRecipePage() {
  return <RecipeBook book={myChoiceRecipes} />
}
