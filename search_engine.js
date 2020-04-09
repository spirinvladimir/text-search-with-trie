//Trie is a n-dimension tree by letters, example
//       c       a    d
//     / |       |    |
//   a   o       t    o
//  /    |            |
// t     p            g
//
// Leaves nodes: [t, p, t, g]
// Each leave have a collection of doc

var zlib = require('zlib')

function create_sn_map () {
    var
        s2n = {},
        n2s = []

    return {
        s: s => {
            var n = s2n[s]
            if (typeof n === 'number') return n
            s2n[s] = n2s.length
            return n2s.push(s) - 1
        },
        n: n => n2s[n]
    }
}

// Search request of splited by letters and go down from root to leave, response is aggregation values from a leaves
function create_letters (char_sn_map_s, word) {
    return word.split('').map(char_sn_map_s)
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
function doc2words (char_sn_map_s, text) {
    return text2words(text).reduce(
        (words, new_word) => {
            if (words.findIndex(_ => _.join('') === new_word) === -1)
                words.push(create_letters(char_sn_map_s, new_word))
            return words
        },
        []
    )
}

// node = [LETTER, DOCS, NEXT]
var DOCS = 0
var NEXT = 1
var ID = 0
var FREQ = 1
var LETTER = 2

function insert_word (trie, word, doc) {
    var letters = word
    var letter
    var node

    //fill trie from root to leave by each letter from a word
    node = letters.reduce(
        (node, letter) => {
            node[NEXT][letter] = node[NEXT][letter] || [[], []]
            return node[NEXT][letter]
        },
        trie
    )

    // add document id to leave
    var $ = node[DOCS]
    var reaction = 1
    var i = $.findIndex(_ => _[0] == doc.id)
    if (i === -1) {
        $.push([doc.id, reaction])
    } else {
        $[i][FREQ] = Math.min(255, $[i][FREQ] + reaction)
        var tmp
        if (reaction === 1)
          while ($[i - 1] && $[i - 1][1] < $[i][1]) {
              tmp = $[i - 1]
              $[i - 1] = $[i]
              $[i] = tmp
              i--
          }
        else
          while ($[i + 1] && $[i + 1][1] > $[i][1]) {
              tmp = $[i + 1]
              $[i + 1] = $[i]
              $[i] = tmp
              i++
          }
    }

    return trie
}

function insert_doc (trie, doc) {
    var words = doc2words(trie[0].char_sn_map.s, doc.text)
    doc.id = trie[0].word_sn_map.s(doc.id)
    return words.reduce(
        (trie, word) => insert_word(trie, word, doc),
        trie
    )
}

function search_word (node, word) {
    while (word.length) {
      node = node[NEXT][word.shift()]
      if (node === undefined) return []
    }

    return node[DOCS]
}

function search_words (trie, words) {
    var rank_per_doc = words.reduce(
        (rank_per_doc, word) =>
            search_word(trie, word).reduce(
                (rank_per_doc, doc) => {
                    rank_per_doc[doc[ID]] = rank_per_doc[doc[ID]] || 0
                    rank_per_doc[doc[ID]] += 1
                    return rank_per_doc
                },
                rank_per_doc
            ),
        {}
    )

    return Object.keys(rank_per_doc).map(id => {
        return {
            id: trie[0].word_sn_map.n(id),
            rank: rank_per_doc[id] / words.length
        }
    }).sort((a, b) => b.rank - a.rank)// hightest rank at top
}

function search (trie, text) {
    return search_words(trie, text2words(text).map(word => create_letters(trie[0].char_sn_map.s, word)))
}

function create_trie () {
    var char_sn_map = create_sn_map()
    var word_sn_map = create_sn_map()

    return [{char_sn_map, word_sn_map}, [], 0]
}

function to_buffer (trie) {
    var size = buffers => buffers.reduce((size, buffer) => size + buffer.byteLength, 0)
    var tmp = trie[DOCS]
    trie[DOCS] = []

    function pack_deep (node) {
        var b_next_nodes = node[NEXT]
            .reduce(
                (acc, next_node, letter) => {
                    next_node[LETTER] = letter
                    acc.push(next_node)

                    return acc
                },
                []
            ).map(next_node => pack_deep(next_node))

        var bnext = Buffer.concat(b_next_nodes, size(b_next_nodes))

        var letter = Buffer(1)
        letter.writeUInt8(node[LETTER])
        var res = Buffer.concat(
            node[DOCS].map((a, i) => {
                var id = a[0]
                var freq = a[1]
                var b_id = Buffer(1)
                b_id.writeUInt8(id)
                var b_freq = Buffer(1)
                b_freq.writeUInt8(freq)
                return Buffer.concat([b_id, b_freq], 2)
            }),
            node[DOCS].length * 2/* uint8 size is 1 byte */
        )

        var info_res = Buffer(1)//have to calculate how much bytes request biggest node[DOCS]
        info_res.writeUInt8(res.byteLength)

        var bnode = Buffer.concat(
            [
                letter,
                info_res,
                res,
                bnext
            ],
            size([letter, info_res, res, bnext])
        )

        var info = Buffer(4)
        info.writeUInt32BE(bnode.byteLength)

        return Buffer.concat(
            [
                info,
                bnode
            ],
            size([info, bnode])
        )
    }

    var pack = pack_deep(trie)
    trie[DOCS] = tmp
    return pack
}

module.exports.create_trie = create_trie
module.exports.insert_doc = insert_doc
module.exports.search = search
module.exports.to_buffer = to_buffer
