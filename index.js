var zlib = require('zlib')
var fs = require('fs')
var m5 = require('msgpack5')()
var YAML = require('yamljs')
var BSON = require('bson')
var snappy = require('snappy')
var lz4 = require('lz4')
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
        return list.concat(fs.statSync(name).isDirectory() ? file_list(name) : name)
    }, [])
}

console.time('indexing...')

new Promise((y, n) =>
    fs.readFile('cache.gz', (e, buffer) => {
        var trie

        if (!e) {
            zlib.gunzip(buffer, (e, _) => {
                console.log('gunzip', typeof _, _, JSON.parse(_))
                y(JSON.parse(_))
            })
        } else {
            var files = file_list(process.argv.slice(2)[0] || '.')
            if (files.length === 0) process.exit(1)

            // Indexing folder content to TRIE (base data structure for fast text search requests)
            // props - fast search
            // cons  - slow indexing
            trie = files.reduce(
                (trie, id) => {
                    return insert_doc(trie, {id, text: fs.readFileSync(id, 'utf8')})
                },
                create_trie({})
            )
            var fn
            var msgpack = m5.encode(trie)
            fn = 'cache~msgpack5';fs.writeFileSync(fn, msgpack);console.log(fn)
            fn = 'cache~msgpack5-gz';fs.writeFileSync(fn, zlib.gzipSync(msgpack));console.log(fn)
            fn = 'cache~msgpack5-lz4';fs.writeFileSync(fn, lz4.encode(msgpack));console.log(fn)
            fn = 'cache~msgpack5-snappy';fs.writeFileSync(fn, snappy.compressSync(msgpack));console.log(fn)

            var bson = BSON.serialize(trie)
            fn = 'cache~bson';fs.writeFileSync(fn, bson);console.log(fn)
            fn = 'cache~bson-gz';fs.writeFileSync(fn, zlib.gzipSync(bson));console.log(fn)
            fn = 'cache~bson-lz4';fs.writeFileSync(fn, lz4.encode(bson));console.log(fn)
            fn = 'cache~bson-snappy';fs.writeFileSync(fn, snappy.compressSync(bson));console.log(fn)

            var json = JSON.stringify(trie)
            fn = 'cache~json';fs.writeFileSync(fn, Buffer.from(json));console.log(fn)
            fn = 'cache~json-gz';fs.writeFileSync(fn, zlib.gzipSync(json));console.log(fn)
            fn = 'cache~json-lz4';fs.writeFileSync(fn, lz4.encode(json));console.log(fn)
            fn = 'cache~json-snappy';fs.writeFileSync(fn, snappy.compressSync(json));console.log(fn)

            var yaml = YAML.stringify(trie)
            fn = 'cache~yaml';fs.writeFileSync(fn, Buffer.from(yaml));console.log(fn)
            fn = 'cache~yaml-gz';fs.writeFileSync(fn, zlib.gzipSync(yaml));console.log(fn)
            fn = 'cache~yaml-lz4';fs.writeFileSync(fn, lz4.encode(yaml));console.log(fn)
            fn = 'cache~yaml-snappy';fs.writeFileSync(fn, snappy.compressSync(yaml));console.log(fn)

            y(trie)
        }
    })
).then(trie => {
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
