import React, { Component } from 'react';
import AutoComplete from 'antd/lib/auto-complete';
import Tooltip from 'antd/lib/tooltip';
import _ from 'lodash';
import PrefixSearch from './prefix-search';
import getAncestors from './get-ancestors';
import Set from 'es6-set';
import wikidataSynonymData from './wikidata-synonyms.json';

const Option = AutoComplete.Option;

const MaxMatches = 500;

function indexNodes(nodes) {
  const index = new PrefixSearch();
  const wikidataSynonyms = wikidataSynonymData['terms'];

  for (const n of nodes) {
    index.indexNode(n, n.name.en, 'name_en', true, 'en');
    index.indexNode(n, n.name.la, 'name_la', true, 'la');
    index.indexNode(n, n.name.es, 'name_es', true, 'es');
    let terms = new Set();
    for (const v of _.values(n.name)) {
      terms.add(v);
    }

    for (const s of n.synonyms) {
      if (!terms.has(s)) {
        index.indexNode(n, s, 'synonym', false, null);
        terms.add(s);
      }
    }

    const wds = wikidataSynonyms[n.id];
    if (wds) {
      for (const s of wds) {
        if (!terms.has(s)) {
          index.indexNode(n, s, 'wikidata_synonym', false, null);
          terms.add(s);
        }
      }
    }

    index.indexNode(n, n.id, 'id', true, null);
  }
  return index;
}

function getBestMatching(nodes, lang) {
  // terms might be matched by multiple phrases (e.g., synonyms).
  // We only display one per term, so we want to make sure that the
  // we get the primary term if possible.
  let matchingNodes = [];
  const grouped = _.groupBy(nodes, n => n.node.id);
  for (const mv of _.values(grouped)) {
    const v = _.find(mv, i => i.term === i.node.name[lang]);
    if (v) {
      matchingNodes.push(v);
    }
    else {
      matchingNodes.push(mv[0]);
    }
  }
  return _.sortBy(matchingNodes, [o => o.node.name[lang]]);
}

function promoteExactMatches(nodes, searchString) {
  let preferredMatchingNodes = [];
  let exactMatchingNodes = [];
  let otherMatchingNodes = [];

  const lowercaseExact = searchString.toLowerCase();
  // some mobile devices want to initial cap the string

  for (const n of nodes) {
    if (n.term.startsWith(lowercaseExact)) {
      if (n.pref) {
        preferredMatchingNodes.push(n);
      }
      else {
        exactMatchingNodes.push(n);
      }
    }
    else {
      otherMatchingNodes.push(n);
    }
  }
  preferredMatchingNodes = _.sortBy(preferredMatchingNodes, o => o.term.length);
  exactMatchingNodes = _.sortBy(exactMatchingNodes, o => o.term.length);
  otherMatchingNodes = _.sortBy(otherMatchingNodes, o => o.term.length);

  return [preferredMatchingNodes, exactMatchingNodes, otherMatchingNodes];
}

class TAComplete extends Component {
  state = {
    searchString: '',
    matchingNodes: null,
    selectedNode: null
  }

  componentDidMount() {
    const allNodes = this.props.data.getNodes();
    this.prefixSearchIndex = indexNodes(allNodes);

    this.setState({
      matchingNodes: null
    });
  }

  handleSearch = (searchString) => {
    let { language } = this.props;

    const matches = this.prefixSearchIndex.getMatches(searchString);
    const matchingNodes = promoteExactMatches(getBestMatching(matches, language), searchString);

    this.setState({ searchString, matchingNodes });
  }

  onSelect = (v) => {
    if (v) {
      let selectedNode = this.props.data.getNodeById(v);

      this.setState({
        selectedNode,
        matchingNodes: null,
        searchString: null
      });
      if (this.props.onSelect) {
        this.props.onSelect(selectedNode);
      }
    }
  }

  getAncestorNames(n, lang) {
    const ancestors = getAncestors(n);
    const nameElements = [];
    for (let i = 1; i < ancestors.length; i++) {
      nameElements.push(<span key={i}>{ancestors[i].name[lang]}</span>);
    }
    if (nameElements.length === 0) {
      return null;
    }
    return (
      <div className="taviewer-complete-tooltips">{nameElements}</div>
    );
  }

  render() {
    let { matchingNodes } = this.state;
    const { language } = this.props;

    let children;
    let listedMatches;
    let extraChild;
    let numExtra;

    if (!matchingNodes) {
      matchingNodes = [[], [], []]
    }

    if (matchingNodes[0].length
      + matchingNodes[1].length
      + matchingNodes[2].length < MaxMatches) {
      listedMatches = matchingNodes[0].concat(matchingNodes[1], matchingNodes[2]);
      numExtra = 0;
    }
    else {
      if (matchingNodes[0].length + matchingNodes[1].length < MaxMatches) {
        listedMatches = matchingNodes[0].concat(matchingNodes[1]);
        numExtra = matchingNodes[2].length;
      } 
      else if (matchingNodes[0].length < MaxMatches) {
        listedMatches = matchingNodes[0];
        numExtra = matchingNodes[1].length + matchingNodes[2].length;
      }
      else {
        listedMatches = [];
        numExtra = matchingNodes[0].length + matchingNodes[1].length + matchingNodes[2].length;
      }
      extraChild = numExtra ? <Option
        disabled={true}
        key="TooMany">{numExtra} more matches...</Option> : null;
    }

    children = _.map(listedMatches, md => {
      const m = md.node;
      const tooltipContent = this.getAncestorNames(m, language);
      const primaryTerm = m.name[language];
      const matchingTerm = md.term;

      const printTerm = primaryTerm === matchingTerm ?
        primaryTerm : `${matchingTerm} (${primaryTerm})`;
      return <Option value={m.id} key={m}>
        {
          tooltipContent ?
            <Tooltip
              key={m.id}
              placement="right"
              arrowPointAtCenter={true}
              mouseEnterDelay={0.7}
              overlayClassName="taviewer-complete-tooltip"
              title={tooltipContent}>{printTerm} ({m.id})
              </Tooltip>
            : <span>{printTerm} ({m.id})</span>
        }
      </Option>
    });
    return (
      <div className="taviewer-complete" >
        <AutoComplete
          showSearch
          allowClear
          optionLabelProp="value"
          ref="autocomplete"
          value={this.state.searchString}
          onSelect={this.onSelect}
          onSearch={this.handleSearch}
          placeholder="search (e.g. thalamus)">
          {children.concat(extraChild)}
        </AutoComplete>
      </div>
    )
  }

}

export default TAComplete;