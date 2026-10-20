// ─────────────────────────────────────────────────────────────────────────────
//  HYDERABAD READS · THE SHARED SHELF
//
//  This file is the whole library. To add books, find your name below (or copy
//  a reader block for someone new) and add a line to their `books` list.
//
//  Only `title` and `author` are required. Everything else is optional:
//
//    genre     One of the genres listed in GENRES below (or any new word).
//    blurb     A line or two about the book, shown when someone opens it.
//    note      Your own note: "Loved it", "margins full of scribbles"...
//    onLoanTo  Name of whoever currently has it. Remove the line when it's back.
//    isbn      Only if the wrong cover shows up: an ISBN pins the exact edition.
//    year      Only if the first-published year shown is wrong.
//
//  Covers, page counts and spine colours are fetched automatically on deploy.
//  Commit to `main` and the site updates itself in about a minute.
// ─────────────────────────────────────────────────────────────────────────────

export const CLUB = {
  name: 'Hyderabad Reads',
  tagline: 'Every book on our shelves, in one place.',
  meets: 'Weekend book club · Hyderabad',
}

// Genre → shelf-label colour. Unknown genres get a colour of their own.
export const GENRES = {
  'Literary Fiction': '#c8875e',
  Fiction: '#d9a55b',
  Classics: '#b7a27a',
  'Sci-Fi & Fantasy': '#6f9fc9',
  Mythology: '#d77f5a',
  'Thriller & Mystery': '#a46a8e',
  'Memoir & Biography': '#8fb08a',
  History: '#c49a6c',
  'Mind & Philosophy': '#9a8fd0',
  'Business & Money': '#5fae9f',
  'Self-Help': '#e0b04f',
}

export const readers = [
  {
    name: 'Aditya',
    books: [
      { title: 'Sapiens', author: 'Yuval Noah Harari', genre: 'History',
        blurb: 'How a forgettable ape became the species that runs the planet, told through three revolutions: cognitive, agricultural and scientific.' },
      { title: 'Atomic Habits', author: 'James Clear', genre: 'Self-Help', onLoanTo: 'Jitesh',
        blurb: 'Small, boring, one-percent changes, and why they compound into something remarkable.' },
      { title: 'The Psychology of Money', author: 'Morgan Housel', genre: 'Business & Money',
        blurb: 'Short essays on why behaviour, not spreadsheets, decides how well we do with money.' },
      { title: 'Project Hail Mary', author: 'Andy Weir', genre: 'Sci-Fi & Fantasy',
        blurb: 'A lone astronaut wakes up with no memory and one job: save Earth. Science-nerd joy from first page to last.' },
      { title: 'Shoe Dog', author: 'Phil Knight', genre: 'Memoir & Biography', isbn: '9781501135910',
        blurb: 'The founder of Nike on the messy, near-bankrupt early years of building it.' },
    ],
  },
  {
    name: 'Piyush',
    books: [
      { title: 'The God of Small Things', author: 'Arundhati Roy', genre: 'Literary Fiction',
        blurb: 'Twins in 1960s Kerala, and the small things that break a family. Language that feels like monsoon.' },
      { title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman', genre: 'Mind & Philosophy',
        blurb: 'The two systems that drive how we think, and all the ways they trip us up.' },
      { title: 'Dune', author: 'Frank Herbert', genre: 'Sci-Fi & Fantasy', isbn: '9780441172719',
        blurb: 'Desert politics, prophecy and spice on Arrakis. The science-fiction epic everything else borrows from.' },
      { title: 'The White Tiger', author: 'Aravind Adiga', genre: 'Fiction',
        blurb: 'A driver from a Bihar village narrates his darkly funny climb out of India’s servant class.' },
      { title: 'Zero to One', author: 'Peter Thiel', genre: 'Business & Money', year: 2014,
        blurb: 'Notes on startups and how to build things that do not exist yet.' },
    ],
  },
  {
    name: 'Priyank',
    books: [
      { title: 'The Alchemist', author: 'Paulo Coelho', genre: 'Fiction',
        blurb: 'A shepherd boy crosses the desert chasing a dream and a treasure. A short fable about listening to your heart.' },
      { title: 'Ikigai', author: 'Héctor García', genre: 'Self-Help',
        blurb: 'What the long-lived people of Okinawa can teach us about purpose and a slower life.' },
      { title: 'Deep Work', author: 'Cal Newport', genre: 'Self-Help',
        blurb: 'The case for focused, distraction-free work, and how to build a life around it.' },
      { title: 'The Silent Patient', author: 'Alex Michaelides', genre: 'Thriller & Mystery',
        blurb: 'A painter shoots her husband and never speaks again. Her therapist is determined to find out why.' },
      { title: 'Wings of Fire', author: 'A. P. J. Abdul Kalam', genre: 'Memoir & Biography', isbn: '9788173711466',
        blurb: 'From a boyhood in Rameswaram to India’s missile programme: Kalam in his own words.' },
    ],
  },
  {
    name: 'Akansha',
    books: [
      { title: 'Pride and Prejudice', author: 'Jane Austen', genre: 'Classics', isbn: '9780141439518',
        blurb: 'Elizabeth Bennet, Mr Darcy, and two centuries of first impressions gone wrong.' },
      { title: 'The Palace of Illusions', author: 'Chitra Banerjee Divakaruni', genre: 'Mythology', isbn: '9780330458535',
        blurb: 'The Mahabharata retold by Draupadi: fierce, funny and finally centre stage.' },
      { title: 'Educated', author: 'Tara Westover', genre: 'Memoir & Biography',
        blurb: 'Raised off the grid in Idaho with no schooling, she taught herself her way to a Cambridge PhD.' },
      { title: 'Normal People', author: 'Sally Rooney', genre: 'Literary Fiction',
        blurb: 'Connell and Marianne, from a small Irish town to Trinity College, never quite in sync.' },
      { title: 'The Midnight Library', author: 'Matt Haig', genre: 'Fiction',
        blurb: 'Between life and death sits a library holding every life you could have lived.' },
    ],
  },
  {
    name: 'Murchana',
    books: [
      { title: 'A Suitable Boy', author: 'Vikram Seth', genre: 'Literary Fiction',
        blurb: 'A mother’s hunt for her daughter’s husband in 1950s India. 1,300 pages you will wish were longer.' },
      { title: 'Norwegian Wood', author: 'Haruki Murakami', genre: 'Literary Fiction',
        blurb: 'Tokyo in the late sixties, a Beatles song, and a young man caught between two women.' },
      { title: 'The Book Thief', author: 'Markus Zusak', genre: 'Fiction',
        blurb: 'Nazi Germany, narrated by Death, about a girl who steals books and shares them.' },
      { title: 'Circe', author: 'Madeline Miller', genre: 'Mythology',
        blurb: 'The witch of the Odyssey tells her own story: exile, gods, monsters and power.' },
      { title: 'The Namesake', author: 'Jhumpa Lahiri', genre: 'Fiction',
        blurb: 'A Bengali family in America and a son stuck with a name that never feels like his.' },
    ],
  },
  {
    name: 'Jitesh',
    books: [
      { title: 'The Immortals of Meluha', author: 'Amish Tripathi', genre: 'Mythology', isbn: '9789380658742',
        blurb: 'Shiva reimagined as a Tibetan tribal chief who may be the saviour Meluha has been waiting for.' },
      { title: 'Rich Dad Poor Dad', author: 'Robert T. Kiyosaki', genre: 'Business & Money',
        blurb: 'Two fathers, two money mindsets, and the lessons that started a million side hustles.' },
      { title: 'The Hitchhiker’s Guide to the Galaxy', author: 'Douglas Adams', genre: 'Sci-Fi & Fantasy',
        blurb: 'Earth is demolished for a bypass. Don’t panic, bring a towel, and remember the answer is 42.' },
      { title: 'Man’s Search for Meaning', author: 'Viktor E. Frankl', genre: 'Mind & Philosophy', isbn: '9780807014271',
        blurb: 'A psychiatrist’s account of the concentration camps, and of why meaning is what keeps us alive.' },
      { title: 'The Kite Runner', author: 'Khaled Hosseini', genre: 'Fiction',
        blurb: 'Two boys in Kabul, one betrayal, and a lifetime spent trying to make it right.' },
    ],
  },
  {
    name: 'Rahul',
    books: [
      { title: 'Nineteen Eighty-Four', author: 'George Orwell', genre: 'Classics',
        blurb: 'Big Brother is watching. The novel that gave us doublethink, thoughtcrime and Room 101.' },
      { title: 'The Hound of the Baskervilles', author: 'Arthur Conan Doyle', genre: 'Thriller & Mystery',
        blurb: 'A family curse, a spectral hound on the moors, and Holmes at his best.' },
      { title: 'The Lean Startup', author: 'Eric Ries', genre: 'Business & Money',
        blurb: 'Build, measure, learn: the playbook for testing ideas before betting everything on them.' },
      { title: 'Gone Girl', author: 'Gillian Flynn', genre: 'Thriller & Mystery',
        blurb: 'On their fifth anniversary, Amy disappears. Everyone suspects Nick. Nothing is what it seems.' },
      { title: 'Midnight’s Children', author: 'Salman Rushdie', genre: 'Literary Fiction',
        blurb: 'Born at the stroke of India’s independence, Saleem Sinai’s life is bound to his nation’s.' },
    ],
  },
  {
    name: 'Carel',
    books: [
      { title: 'The Little Prince', author: 'Antoine de Saint-Exupéry', genre: 'Classics', isbn: '9780156012195',
        blurb: 'A pilot stranded in the Sahara meets a small prince from a tiny planet. Written for children, meant for grown-ups.' },
      { title: 'To Kill a Mockingbird', author: 'Harper Lee', genre: 'Classics',
        blurb: 'Scout Finch watches her father defend a Black man in 1930s Alabama.' },
      { title: 'The Hobbit', author: 'J. R. R. Tolkien', genre: 'Sci-Fi & Fantasy',
        blurb: 'Bilbo Baggins, thirteen dwarves, one dragon, and a ring that turns out to matter.' },
      { title: 'Becoming', author: 'Michelle Obama', genre: 'Memoir & Biography',
        blurb: 'From the South Side of Chicago to the White House: a warm, candid memoir.' },
      { title: 'Klara and the Sun', author: 'Kazuo Ishiguro', genre: 'Sci-Fi & Fantasy',
        blurb: 'An artificial friend watches the world from a shop window and learns what it means to love.' },
    ],
  },
]
