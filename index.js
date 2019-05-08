var fs = require('fs')
var path = require('path')
var readline = require('readline')
var config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'))
var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'search> '
})
var {create_trie, insert_doc, search} = require('./search_engine')

// Convert dirname to list filenames
// String  -> [String]
function file_list (dir) {
    return fs.readdirSync(dir).reduce((list, file) => {
        var name = path.join(dir, file)
        return list.concat(fs.statSync(name).isDirectory() ? file_list(name) : [name])
    }, [])
}

var files = file_list(process.argv.slice(2)[0] || '.')
if (files.length === 0) process.exit(1)

// Indexing folder content to TRIE (base data structure for fast text search requests)
// props - fast search
// cons  - slow indexing
console.log('indexing...')
var trie = files.reduce(
    (trie, id) => {
        return insert_doc(trie, {id, text: fs.readFileSync(id, 'utf8')})
    },
    create_trie({})
)

rl.prompt()
rl.on('line', line => {
    var results = search(trie, line)
    if (results.length === 0) console.log('no matches found')
    else results
        .filter((_, i) => i < config.max_docs_count)
        .forEach(file => console.log(Math.round(100 * file.rank) + '%\t' + file.id))
    rl.prompt()
}).on('close', () => process.exit(0))
