// @flow
const {createLayout} = require('../../util/struct_array');

const lineLayoutAttributes = createLayout([
    {name: 'a_pos_normal', components: 4, type: 'Int16'},
    {name: 'a_data', components: 4, type: 'Uint8'}
], 4);

// these attributes are only needed if using data-driven line-pattern
const linePatternSourceExpressionLayout = createLayout([
    // [tl.x, tl.y, br.x, br.y]
    {name: 'a_pattern_a',  components: 2, type: 'Float32'},
    {name: 'a_pattern_b',  components: 2, type: 'Float32'}
]);

const linePatternCompositeExpressionLayout = createLayout([
    // [tl.x, tl.y, br.x, br.y]
    {name: 'a_pattern_a',  components: 4, type: 'Float32'},
    {name: 'a_pattern_b',  components: 4, type: 'Float32'}
]);

module.exports = {lineLayoutAttributes, linePatternSourceExpressionLayout, linePatternCompositeExpressionLayout};
