import type { Product } from '../types'

export const mockProducts: Product[] = [
  {
    id: 'p1',
    name: 'Signature Celebration Cake',
    slug: 'signature-celebration-cake',
    category: 'Cakes',
    description: 'A statement cake for birthdays, weddings, and elegant events.',
    longDescription:
      'Soft, fluffy sponge layered with velvety frosting, finished with a handcrafted floral design and rich buttercream details. Made for meaningful milestones and joyful gatherings.',
    price: 48000,
    image:
      'https://images.unsplash.com/photo-1559620192-032c4bc4674e?auto=format&fit=crop&w=1200&q=80',
    images: [
      'https://images.unsplash.com/photo-1559620192-032c4bc4674e?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=1200&q=80',
    ],
    featured: true,
    bestseller: true,
    available: true,
    stock: 12,
    variants: [
      { label: '6-inch', price: 48000 },
      { label: '8-inch', price: 68000 },
      { label: '10-inch', price: 95000 },
    ],
    customisationPrompt: 'Share your event theme, colours, and any personal message you would like piped on the cake.',
  },
  {
    id: 'p2',
    name: 'Chocolate Fudge Delight',
    slug: 'chocolate-fudge-delight',
    category: 'Cakes',
    description: 'Deep cocoa layers with silky ganache and a rich buttercream finish.',
    longDescription:
      'A luxurious cake for true chocolate lovers, featuring dark cocoa sponge, glossy ganache, and a velvety texture that melts elegantly on the palate.',
    price: 42000,
    image:
      'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1200&q=80',
    images: [
      'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=80',
    ],
    featured: true,
    bestseller: false,
    available: true,
    stock: 10,
    variants: [
      { label: 'Mini', price: 42000 },
      { label: 'Standard', price: 54000 },
    ],
  },
  {
    id: 'p3',
    name: 'Butter Croissant',
    slug: 'butter-croissant',
    category: 'Pastries',
    description: 'Flaky layers, golden crisp edges, and a rich buttery finish.',
    longDescription:
      'Baked fresh daily for that unmistakable crispness and buttery aroma. Perfect with coffee, tea, or on its own as a simple indulgence.',
    price: 3500,
    image:
      'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=1200&q=80',
    images: [
      'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=80',
    ],
    featured: true,
    bestseller: true,
    available: true,
    stock: 50,
    variants: [{ label: 'Single', price: 3500 }, { label: 'Box of 6', price: 18000 }],
  },
  {
    id: 'p4',
    name: 'Vanilla Bean Cupcakes',
    slug: 'vanilla-bean-cupcakes',
    category: 'Desserts',
    description: 'Soft vanilla sponge topped with cloud-like buttercream swirls.',
    longDescription:
      'A classic crowd favourite with delicate vanilla notes, a tender crumb, and just the right touch of sweetness for every celebration table.',
    price: 2800,
    image:
      'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=1200&q=80',
    images: [
      'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=1200&q=80',
    ],
    featured: false,
    bestseller: true,
    available: true,
    stock: 30,
    variants: [{ label: 'Pack of 4', price: 2800 }, { label: 'Pack of 8', price: 5200 }],
  },
  {
    id: 'p5',
    name: 'Berry Cheesecake Jar',
    slug: 'berry-cheesecake-jar',
    category: 'Desserts',
    description: 'Creamy cheesecake layered with berry compote and biscuit crumble.',
    longDescription:
      'Rich and velvety, this jar dessert balances the sweetness of berry compote with a smooth cheesecake finish for a refined take on dessert nostalgia.',
    price: 6200,
    image:
      'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=1200&q=80',
    images: [
      'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=1200&q=80',
    ],
    featured: true,
    bestseller: false,
    available: true,
    stock: 18,
    variants: [{ label: 'Regular', price: 6200 }, { label: 'Sharing', price: 15000 }],
  },
  {
    id: 'p6',
    name: 'Fruit Tart Collection',
    slug: 'fruit-tart-collection',
    category: 'Special Treats',
    description: 'Buttery tart shells filled with fresh fruit and custard cream.',
    longDescription:
      'A vibrant dessert made with crisp pastry, a delicate custard base, and colourful fruit toppings that bring both beauty and refreshment to every plate.',
    price: 7200,
    image:
      'https://images.unsplash.com/photo-1464306076886-da185f6a9d8d?auto=format&fit=crop&w=1200&q=80',
    images: [
      'https://images.unsplash.com/photo-1464306076886-da185f6a9d8d?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1499636136210-6d4eea6d7c7b?auto=format&fit=crop&w=1200&q=80',
    ],
    featured: false,
    bestseller: true,
    available: true,
    stock: 25,
    variants: [{ label: 'Single', price: 7200 }, { label: 'Box of 4', price: 25000 }],
  },
]
