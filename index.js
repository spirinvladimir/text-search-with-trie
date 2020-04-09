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
var { promisify } = require('util')
var { resolve } = require('path')
var readdir = promisify(fs.readdir)
var stat = promisify(fs.stat)
var readFile = promisify(fs.readFile)

function file_list (dir) {
    return readdir(dir)
        .then(files =>
            Promise.all(
                files.map(id => {
                    id = resolve(dir, id)
                    return stat(id).then(stats =>
                        stats.isDirectory()
                            ? file_list(id)
                            : {id, size: stats.size}
                    )
                })
            )
                .then(deep => deep.reduce((flat, i) => flat.concat(i), []))
        )
}



file_list(process.argv.slice(2)[0] || '.').then(items => {
    if (items.length === 0) process.exit(1)

    var files = items.map(item => item.id)
    var total_size = items.reduce((size, item) => size + item.size, 0)

    console.log('Count files:', files.length)
    console.log('Total size:', total_size)

// Indexing folder content to TRIE (base data structure for fast text search requests)
// props - fast search
// cons  - slow indexing

    console.time('indexing...')

    var trie = create_trie()

    var done = 0
    console.log(1)
    Promise.all(
        items.map(({id, size}) =>
            console.log(2) || readFile(id, 'utf8').then(text => {
                console.log(3) || insert_doc(trie, {id, text})
                done += size
                console.log(done / total_size)
            })
        )
    )
        .then(() => {
            console.timeEnd('indexing...')
            rl.prompt()
            rl.on('line', line => {
                var results = search(trie, line)
                if (results.length === 0) console.log('no matches found')
                else results
                    .filter((_, i) => i < config.max_docs_count)
                    .forEach(file => console.log(Math.round(100 * file.rank) + '%\t' + file.id))
                rl.prompt()
            }).on('close', () => process.exit(0))
    })
})
