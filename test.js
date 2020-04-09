var assert = require('assert')
var {create_trie, insert_doc, search, to_buffer} = require('./search_engine')

describe('Text search', () => {

    it('should be sorted by rank', () => {
        var trie = [
            {id: './doc1', text: 'cat'    },
            {id: './doc2', text: 'cat dog'},
        ].reduce(insert_doc, create_trie())

        assert.deepEqual(
            search(trie, 'cat dog'),
            [
                {id: './doc2', rank: 1  },
                {id: './doc1', rank: 0.5}
            ]
        )
    })

    it('should cache same words in a document', () => {
        var trie = [
            {id: './doc', text: 'cat cat'}
        ].reduce(insert_doc, create_trie())

        assert.deepEqual(
            search(trie, 'cat'),
            [
                {id: './doc', rank: 1}
            ]
        )
    })

    it('should not find not exist word', () => {
        var trie = [
            {id: './doc', text: 'cat'}
        ].reduce(insert_doc, create_trie())

        assert.deepEqual(
            search(trie, 'dog'),
            []
        )
    })

    it('should not find word if it is a part of another word', () => {
        var trie = [
            {id: './doc', text: 'butterfly'}
        ].reduce(insert_doc, create_trie())

        assert.deepEqual(
            search(trie, 'butter'),
            []
        )
    })

    it('should not find word if it is a part of another word', () => {
        var trie = [
            {id: './doc', text: 'butterfly'}
        ].reduce(insert_doc, create_trie())

        assert.deepEqual(
            search(trie, 'butter'),
            []
        )
    })

    it('.to_buffer(trie) should return buffer', () => {
        var trie = [
            {id: './my.txt', text: 'cat'}
        ].reduce(insert_doc, create_trie())

        assert.ok(
            to_buffer(trie) instanceof Buffer
        )
    })
})
