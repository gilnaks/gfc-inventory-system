import type { ActionStep, FlavorRecipe, IngredientStep, RecipeBook } from './types'

function action(label: string): ActionStep {
  return { kind: 'action', label }
}

function ingredient(
  quantity: string | null,
  name: string,
  method: IngredientStep['method']
): IngredientStep {
  return { kind: 'ingredient', quantity, name, method }
}

const addBase = action('Add Ice Cream Base to machine')
const extract = action('Extract')

function flavor(name: string, steps: FlavorRecipe['steps']): FlavorRecipe {
  return { name, steps }
}

export const myChoiceRecipes: RecipeBook = {
  brand: 'MyChoice',
  slug: 'mychoice',
  yieldLabel: '1 pan per batch',
  baseNote: 'Every flavor below uses one batch of this base.',
  methods: [
    {
      method: 'mix',
      label: 'Mix',
      description: 'Mix inside the stainless pan during extraction',
    },
    {
      method: 'blend',
      label: 'Blend',
      description: 'Blend the ingredient into the Ice Cream Base',
    },
    {
      method: 'machine',
      label: 'Machine',
      description: 'Pour the ingredient in the machine',
    },
    {
      method: 'drizzle',
      label: 'Drizzle',
      description: 'Slow mix of syrup or jam inside the stainless pan',
    },
    {
      method: 'fold',
      label: 'Fold',
      description: 'Slow folding of 2 ice cream flavors',
    },
  ],
  base: {
    name: 'Ice Cream Base',
    method: 'blend',
    ingredients: [
      { quantity: '1 kilo', name: 'Ice Cream Premix Powder' },
      { quantity: '200 mL', name: 'Liquid Premix' },
      { quantity: '2000 mL', name: 'Water' },
    ],
  },
  flavors: [
    flavor('Bubblegum', [
      addBase,
      ingredient('15 mL', 'Bubblegum flavor', 'machine'),
      ingredient('2.5 mL', 'Green food color', 'machine'),
      ingredient('1 mL', 'Blue food color', 'machine'),
      extract,
      ingredient('100 grams', 'small Marshmallows', 'mix'),
    ]),
    flavor('Butterscotch', [
      addBase,
      ingredient('1/3 cup', 'Butterscotch', 'machine'),
      extract,
      ingredient('1/3 cup', 'Butterscotch', 'mix'),
    ]),
    flavor('Cookie Bits', [
      addBase,
      extract,
      ingredient('5 pcs', 'Crushed Chocolate Cookies', 'mix'),
    ]),
    flavor('Chocolate', [
      ingredient('75 g', 'Cocoa Powder', 'blend'),
      addBase,
      extract,
    ]),
    flavor('Chocolate Brownie', [
      ingredient('75 g', 'Cocoa Powder', 'blend'),
      addBase,
      extract,
      ingredient('5 pcs', 'Crushed Choco Crinkles', 'mix'),
    ]),
    flavor('Chocolate Chip Cookies', [
      addBase,
      ingredient('20 mL', 'Vanilla flavor', 'machine'),
      extract,
      ingredient('5 pcs', 'Crushed Chocolate Chip Cookies', 'mix'),
    ]),
    flavor('Coffee', [
      ingredient('20 g', 'Coffee', 'blend'),
      addBase,
      extract,
    ]),
    flavor('Cookie Monster', [
      addBase,
      ingredient('20 mL', 'Vanilla flavor', 'machine'),
      ingredient('1 mL', 'Blue food color', 'machine'),
      extract,
      ingredient('2 pcs', 'Crushed Chocolate Cookies', 'mix'),
      ingredient('2 pcs', 'Crushed Peanut Cookies', 'mix'),
    ]),
    flavor('Double Chocolate Chip Cookies', [
      ingredient('75 g', 'Cocoa Powder', 'blend'),
      addBase,
      extract,
      ingredient('5 pcs', 'Crushed Double Chocolate Chip Cookies', 'mix'),
    ]),
    flavor('Durian', [
      addBase,
      ingredient('0.5 mL', 'Yellow food color', 'machine'),
      ingredient('1/4 bottle', 'Durian flavor', 'machine'),
      extract,
    ]),
    flavor('Mango', [
      ingredient('180 g', 'Mango', 'blend'),
      ingredient('2 mL', 'Yellow food color', 'blend'),
      addBase,
      extract,
    ]),
    flavor('Mango Crumble', [
      ingredient('180 g', 'Mango', 'blend'),
      ingredient('2 mL', 'Yellow food color', 'blend'),
      addBase,
      extract,
      ingredient('1 pack', 'crushed Eggnog', 'mix'),
    ]),
    flavor('Mango Graham', [
      addBase,
      extract,
      ingredient('1/2 cup', 'Crushed Grahams', 'mix'),
      ingredient('100 mL', 'Mango Jam', 'drizzle'),
    ]),
    flavor('Matcha', [
      ingredient('30 mL', 'Matcha powder', 'blend'),
      ingredient('10 mL', 'Vanilla flavor', 'blend'),
      addBase,
      extract,
    ]),
    flavor('Melon', [
      addBase,
      ingredient('20 mL', 'Melon flavor', 'machine'),
      extract,
    ]),
    flavor('Strawberry Shortcake', [
      addBase,
      ingredient('20 mL', 'Strawberry flavor', 'machine'),
      extract,
      ingredient('1 pack', 'crushed Eggnog', 'mix'),
    ]),
    flavor('Ube', [
      addBase,
      ingredient('20 mL', 'Ube flavor', 'machine'),
      extract,
    ]),
    flavor('Ube Quezo', [
      addBase,
      ingredient('1/6 slice', 'Cheese block', 'blend'),
      ingredient('0.5 mL', 'Yellow food color', 'blend'),
      action('Extract 50%'),
      ingredient('20 mL', 'Ube flavor', 'machine'),
      action('Run machine for 30 seconds'),
      action('Extract 100%'),
      action('Freeze 20 minutes'),
      ingredient(null, 'Fold the two extracts together', 'fold'),
    ]),
    flavor('Unicorn', [
      addBase,
      ingredient('20 mL', 'Strawberry flavor', 'machine'),
      action('Extract 50%'),
      ingredient('2.5 mL', 'Blue food color', 'machine'),
      ingredient('5 mL', 'Cotton Candy flavor', 'machine'),
      action('Extract 100%'),
    ]),
    flavor('Vanilla', [
      addBase,
      ingredient('20 mL', 'Vanilla flavor', 'machine'),
      extract,
    ]),
  ],
}
