import _ from 'lodash';

function index_tree(node_list, index) {
    index = index || {};
    _.forEach(node_list, node => {
        index[node[0]] = node;
        index_tree(node[5], index);
    });
    return index;
}

class NodeIndex {
    constructor(tree) {
        this.tree = tree;
        this.index = index_tree(tree);
    }

    get_node_by_id(id) {
        return this.index[id];
    }

    get_nodes() {
        return _.values(this.index);
    }
}

export default NodeIndex;