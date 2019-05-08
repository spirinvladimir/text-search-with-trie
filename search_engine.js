//Trie is a n-dimension tree by letters, example
//       c       a    d
//     / |       |    |
//   a   o       t    o
//  /    |            |
// t     p            g
//
// Leaves nodes: [t, p, t, g]
// Each leave have a collection of doc

// Search request of splited by letters and go down from root to leave, response is aggregation values from a leaves
function create_letters (word) {
    return word.split('')
}

// Split text by words for indexing words
// Logic of spliting could be custumized here by RegExp
// If we need search by special symbols also RegExp could be: \s+
function text2words (text) {
    return text.split(/\W+/).filter(word => word && word.length >= 1)
}

// Lets increese speed of indexing each document by
// avoid adding same word from same document.
// List of words -> Set of words (no duplicates)
function doc2words (doc) {
    return text2words(doc.text).reduce(
        (words, new_word) => {
            if (words.findIndex(_ => _.join('') === new_word) === -1)
                words.push(create_letters(new_word))
            return words
        },
        []
    )
}

function insert_word (trie, word, doc) {
    var letters = word
    var letter
    var node

    //fill trie from root to leave by each letter from a word
    node = letters.reduce(
        (node, letter) => {
            node[letter] = node[letter] || {}
            return node[letter]
        },
        trie
    )

    // add document id to leave
    node.docs = node.docs || []
    node.docs.push(doc.id)

    return trie
}

function insert_doc (trie, doc) {
    var words = doc2words(doc)

    return words.reduce(
        (trie, word) => insert_word(trie, word, doc),
        trie
    )
}

function search_word (trie, word) {
    var letters = word
    var node = trie
    var letter

    while (letter = letters.shift()) {
        node = node[letter]
        if (node === undefined) return []
    }

    if (node === undefined || node.docs === undefined) return []

    return node.docs
}

function search_words (trie, words) {
    var rank_per_doc = words.reduce(
        (rank_per_doc, word) =>
            search_word(trie, word).reduce(
                (rank_per_doc, id) => {
                    rank_per_doc[id] = rank_per_doc[id] || 0
                    rank_per_doc[id] += 1
                    return rank_per_doc
                },
                rank_per_doc
            ),
        {}
    )

    return Object.keys(rank_per_doc).map(id => {
        return {
            id,
            rank: rank_per_doc[id] / words.length
        }
    }).sort((a, b) => b.rank - a.rank)// hightest rank at top
}

function search (trie, text) {
    return search_words(trie, text2words(text).map(create_letters))
}

function create_trie (trie) {
    return trie
}


module.exports.create_trie = create_trie
module.exports.insert_doc = insert_doc
module.exports.search = search
