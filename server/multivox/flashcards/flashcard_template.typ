#let flashcard-front(term, reading: none, front-context: none) = [
  #set align(center)
  #set text(font: "Noto Sans JP")
  
  // Main term
  #text(size: 20pt, weight: "regular")[#term]
  
  // Reading (furigana/pronunciation)
  #if reading != none and reading != term [
    #v(0.05in)
    #text(size: 16pt, fill: rgb("#666666"))[#reading]
  ]
  
  // Context
  #if front-context != none [
    #v(0.1in)
    #set align(left)
    #text(size: 14pt, fill: rgb("#333333"))[#front-context]
  ]
]

#let flashcard-back(meaning, back-context: none) = [
  #set align(left)
  #set text(font: "Noto Sans JP")
  
  // Meaning
  #text(size: 16pt)[#meaning]
  
  // Back context
  #if back-context != none [
    #v(0.1in)
    #text(size: 14pt, fill: rgb("#333333"))[#back-context]
  ]
]

#let flashcard-page(cards, is-back: false, columns: 3, rows: 8) = {
  set page(
    paper: "us-letter",
    margin: 0pt,
  )
  
  // Calculate grid cell size
  let page-width = 8.5in
  let page-height = 11in
  let cell-width = page-width / columns
  let cell-height = page-height / rows
  
  // Create bordered grid
  grid(
    columns: (cell-width,) * columns,
    rows: (cell-height,) * rows,
    stroke: (
      top: 1pt + black,
      left: 1pt + black,
      right: 1pt + black,
      bottom: 1pt + black,
    ),
    gutter: 0pt,
    inset: 0.2in,
    
    ..if is-back {
      // For back side, reverse each row for double-sided printing
      let processed-cards = ()
      for i in range(0, cards.len(), step: columns) {
        let row-end = calc.min(i + columns, cards.len())
        let row = cards.slice(i, row-end)
        // Pad row to full width if needed
        while row.len() < columns {
          row.push((front: "", front_sub: "", front_context: "", back: "", back_context: ""))
        }
        processed-cards += row.rev()
      }
      processed-cards.map(card => {
        if card.back == "" {
          []
        } else {
          flashcard-back(card.back, back-context: card.back_context)
        }
      })
    } else {
      // Pad cards to fill grid
      let padded-cards = cards
      let cards-needed = columns * rows
      while padded-cards.len() < cards-needed {
        padded-cards.push((front: "", front_sub: "", front_context: "", back: "", back_context: ""))
      }
      padded-cards.map(card => {
        if card.front == "" {
          []
        } else {
          flashcard-front(card.front, reading: card.front_sub, front-context: card.front_context)
        }
      })
    }
  )
}

#let generate-flashcards(cards, columns: 3, rows: 8) = {
  let cards-per-page = columns * rows
  
  // Split cards into batches
  for i in range(0, cards.len(), step: cards-per-page) {
    let end = calc.min(i + cards-per-page, cards.len())
    let batch = cards.slice(i, end)
    
    // Front page
    flashcard-page(batch, is-back: false, columns: columns, rows: rows)
    pagebreak()
    
    // Back page
    flashcard-page(batch, is-back: true, columns: columns, rows: rows)
    pagebreak()
  }
}