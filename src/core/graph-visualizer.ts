import { promises as fs } from 'fs'
import path from 'path'

import { Logger } from '../utils/logger.js'

import type { KnowledgeGraph, GraphIndexStats } from '../types/index.js'

export class GraphVisualizer {
  private logger = Logger.getInstance()

  async generateHtml(
    graph: KnowledgeGraph,
    stats: GraphIndexStats,
    outputPath: string
  ): Promise<void> {
    const html = this.buildHtmlTemplate(graph, stats)

    try {
      await fs.mkdir(path.dirname(outputPath), { recursive: true })
      await fs.writeFile(outputPath, html, 'utf-8')
      this.logger.info(`[oh-memory] Graph visualization saved: ${outputPath}`)
    } catch (error) {
      this.logger.error('[oh-memory] Failed to save graph visualization:', error)
      throw error
    }
  }

  private buildHtmlTemplate(graph: KnowledgeGraph, stats: GraphIndexStats): string {
    const graphData = JSON.stringify(graph)
    const statsData = JSON.stringify(stats)

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>oh-memory Knowledge Graph</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #c9d1d9; overflow: hidden; }
#container { display: flex; height: 100vh; }
#sidebar { width: 280px; background: #161b22; border-right: 1px solid #30363d; padding: 16px; overflow-y: auto; flex-shrink: 0; }
#graph-area { flex: 1; position: relative; }
#stats { margin-bottom: 20px; }
#stats h2 { font-size: 14px; color: #8b949e; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
.stat-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #21262d; }
.stat-label { color: #8b949e; font-size: 13px; }
.stat-value { color: #f0f6fc; font-size: 13px; font-weight: 600; }
#filters h2 { font-size: 14px; color: #8b949e; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
.filter-group { margin-bottom: 12px; }
.filter-group label { display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 4px 0; font-size: 13px; }
.filter-group input[type="checkbox"] { accent-color: #58a6ff; }
.type-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
#search { width: 100%; padding: 8px 12px; background: #0d1117; border: 1px solid #30363d; border-radius: 6px; color: #c9d1d9; font-size: 13px; outline: none; margin-bottom: 16px; }
#search:focus { border-color: #58a6ff; }
#search::placeholder { color: #484f58; }
#detail-panel { position: absolute; top: 16px; right: 16px; width: 300px; background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; display: none; max-height: 80vh; overflow-y: auto; }
#detail-panel.visible { display: block; }
#detail-panel h3 { color: #f0f6fc; margin-bottom: 8px; font-size: 15px; }
#detail-panel .detail-type { font-size: 12px; color: #8b949e; margin-bottom: 12px; }
#detail-panel .detail-section { margin-bottom: 12px; }
#detail-panel .detail-section h4 { font-size: 12px; color: #8b949e; text-transform: uppercase; margin-bottom: 6px; }
#detail-panel .tag { display: inline-block; background: #1f2937; color: #58a6ff; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin: 2px; }
#detail-panel .link-item { font-size: 12px; color: #58a6ff; padding: 2px 0; cursor: pointer; }
#detail-panel .link-item:hover { text-decoration: underline; }
#detail-panel .close-btn { position: absolute; top: 8px; right: 12px; background: none; border: none; color: #8b949e; cursor: pointer; font-size: 18px; }
#detail-panel .close-btn:hover { color: #f0f6fc; }
#tooltip { position: absolute; background: #1c2128; border: 1px solid #30363d; border-radius: 6px; padding: 8px 12px; font-size: 12px; pointer-events: none; display: none; z-index: 100; max-width: 250px; }
#tooltip .tt-title { color: #f0f6fc; font-weight: 600; margin-bottom: 4px; }
#tooltip .tt-type { color: #8b949e; }
svg { width: 100%; height: 100%; }
.node { cursor: pointer; }
.node circle { stroke-width: 2px; }
.node text { font-size: 11px; fill: #c9d1d9; pointer-events: none; }
.link { stroke-opacity: 0.3; }
.link:hover { stroke-opacity: 0.8; }
#legend { position: absolute; bottom: 16px; left: 16px; background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 10px 14px; }
#legend .legend-item { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #8b949e; margin: 4px 0; }
#controls { position: absolute; bottom: 16px; right: 16px; display: flex; gap: 8px; }
#controls button { background: #161b22; border: 1px solid #30363d; color: #c9d1d9; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; }
#controls button:hover { background: #21262d; border-color: #58a6ff; }
</style>
</head>
<body>
<div id="container">
  <div id="sidebar">
    <input type="text" id="search" placeholder="Search nodes...">
    <div id="stats"></div>
    <div id="filters">
      <h2>Filter by Type</h2>
      <div class="filter-group" id="type-filters"></div>
    </div>
  </div>
  <div id="graph-area">
    <svg id="graph-svg"></svg>
    <div id="tooltip"></div>
    <div id="detail-panel">
      <button class="close-btn" onclick="closeDetail()">&times;</button>
      <div id="detail-content"></div>
    </div>
    <div id="legend"></div>
    <div id="controls">
      <button onclick="resetZoom()">Reset</button>
      <button onclick="toggleLabels()">Labels</button>
    </div>
  </div>
</div>
<script src="https://d3js.org/d3.v7.min.js"></script>
<script>
const GRAPH_DATA = ${graphData};
const STATS_DATA = ${statsData};

const TYPE_COLORS = {
  module: '#58a6ff',
  concept: '#f0883e',
  config: '#3fb950',
  synthesis: '#bc8cff'
};

const TYPE_SIZES = {
  module: 6,
  concept: 10,
  config: 5,
  synthesis: 8
};

let showLabels = true;
let activeTypes = new Set(['module', 'concept', 'config', 'synthesis']);
let simulation, svg, g, linkElements, nodeElements;

function init() {
  renderStats();
  renderFilters();
  renderLegend();
  renderGraph();
}

function renderStats() {
  const el = document.getElementById('stats');
  el.innerHTML = '<h2>Statistics</h2>' +
    '<div class="stat-row"><span class="stat-label">Nodes</span><span class="stat-value">' + STATS_DATA.totalNodes + '</span></div>' +
    '<div class="stat-row"><span class="stat-label">Edges</span><span class="stat-value">' + STATS_DATA.totalEdges + '</span></div>' +
    '<div class="stat-row"><span class="stat-label">Modules</span><span class="stat-value">' + (STATS_DATA.modulesCount || 0) + '</span></div>' +
    '<div class="stat-row"><span class="stat-label">Concepts</span><span class="stat-value">' + (STATS_DATA.conceptsCount || 0) + '</span></div>' +
    '<div class="stat-row"><span class="stat-label">Configs</span><span class="stat-value">' + (STATS_DATA.configsCount || 0) + '</span></div>' +
    '<div class="stat-row"><span class="stat-label">Synthesis</span><span class="stat-value">' + (STATS_DATA.synthesisCount || 0) + '</span></div>' +
    '<div class="stat-row"><span class="stat-label">Updated</span><span class="stat-value">' + new Date(STATS_DATA.lastUpdated).toLocaleDateString() + '</span></div>';
}

function renderFilters() {
  const el = document.getElementById('type-filters');
  const types = ['module', 'concept', 'config', 'synthesis'];
  el.innerHTML = types.map(t =>
    '<label><input type="checkbox" checked data-type="' + t + '" onchange="toggleType(\'' + t + '\', this.checked)">' +
    '<span class="type-dot" style="background:' + TYPE_COLORS[t] + '"></span>' + t + '</label>'
  ).join('');
}

function renderLegend() {
  const el = document.getElementById('legend');
  el.innerHTML = Object.entries(TYPE_COLORS).map(([type, color]) =>
    '<div class="legend-item"><span class="type-dot" style="background:' + color + '"></span>' + type + '</div>'
  ).join('');
}

function renderGraph() {
  const container = document.getElementById('graph-area');
  const width = container.clientWidth;
  const height = container.clientHeight;

  d3.select('#graph-svg').selectAll('*').remove();

  svg = d3.select('#graph-svg')
    .attr('width', width)
    .attr('height', height);

  g = svg.append('g');

  const zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => g.attr('transform', event.transform));

  svg.call(zoom);

  const nodeMap = new Map(GRAPH_DATA.nodes.map(n => [n.id, n]));
  const filteredNodes = GRAPH_DATA.nodes.filter(n => activeTypes.has(n.type));
  const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredEdges = GRAPH_DATA.edges.filter(e => filteredNodeIds.has(e.from) && filteredNodeIds.has(e.to));

  const nodes = filteredNodes.map(n => ({...n}));
  const nodeById = new Map(nodes.map(n => [n.id, n]));
  const links = filteredEdges.map(e => ({
    source: e.from,
    target: e.to,
    type: e.type
  }));

  linkElements = g.append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('class', 'link')
    .attr('stroke', '#30363d')
    .attr('stroke-width', 1);

  nodeElements = g.append('g')
    .selectAll('g')
    .data(nodes)
    .join('g')
    .attr('class', 'node')
    .call(d3.drag()
      .on('start', dragStarted)
      .on('drag', dragged)
      .on('end', dragEnded))
    .on('click', (event, d) => { event.stopPropagation(); showDetail(d); })
    .on('mouseover', (event, d) => showTooltip(event, d))
    .on('mouseout', hideTooltip);

  nodeElements.append('circle')
    .attr('r', d => TYPE_SIZES[d.type] || 6)
    .attr('fill', d => TYPE_COLORS[d.type] || '#8b949e')
    .attr('stroke', d => d3.color(TYPE_COLORS[d.type] || '#8b949e').brighter(0.5));

  nodeElements.append('text')
    .attr('dx', d => (TYPE_SIZES[d.type] || 6) + 4)
    .attr('dy', 4)
    .text(d => d.title)
    .style('display', showLabels ? 'block' : 'none');

  simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(80))
    .force('charge', d3.forceManyBody().strength(-200))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(d => (TYPE_SIZES[d.type] || 6) + 10))
    .on('tick', ticked);
}

function ticked() {
  linkElements
    .attr('x1', d => d.source.x)
    .attr('y1', d => d.source.y)
    .attr('x2', d => d.target.x)
    .attr('y2', d => d.target.y);

  nodeElements.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
}

function dragStarted(event) {
  if (!event.active) simulation.alphaTarget(0.3).restart();
  event.subject.fx = event.subject.x;
  event.subject.fy = event.subject.y;
}

function dragged(event) {
  event.subject.fx = event.x;
  event.subject.fy = event.y;
}

function dragEnded(event) {
  if (!event.active) simulation.alphaTarget(0);
  event.subject.fx = null;
  event.subject.fy = null;
}

function showTooltip(event, d) {
  const tooltip = document.getElementById('tooltip');
  tooltip.innerHTML = '<div class="tt-title">' + d.title + '</div><div class="tt-type">' + d.type + '</div>';
  tooltip.style.display = 'block';
  tooltip.style.left = (event.pageX + 12) + 'px';
  tooltip.style.top = (event.pageY - 12) + 'px';
}

function hideTooltip() {
  document.getElementById('tooltip').style.display = 'none';
}

function showDetail(d) {
  const panel = document.getElementById('detail-panel');
  const content = document.getElementById('detail-content');
  const node = GRAPH_DATA.nodes.find(n => n.id === d.id);
  if (!node) return;

  const inEdges = GRAPH_DATA.edges.filter(e => e.to === node.id);
  const outEdges = GRAPH_DATA.edges.filter(e => e.from === node.id);

  let html = '<h3>' + node.title + '</h3>';
  html += '<div class="detail-type">' + node.type + '</div>';

  if (node.description) {
    html += '<div class="detail-section"><h4>Description</h4><p style="font-size:12px;color:#c9d1d9;">' + node.description + '</p></div>';
  }

  if (node.tags && node.tags.length > 0) {
    html += '<div class="detail-section"><h4>Tags</h4>' + node.tags.map(t => '<span class="tag">' + t + '</span>').join('') + '</div>';
  }

  if (inEdges.length > 0) {
    html += '<div class="detail-section"><h4>Referenced By (' + inEdges.length + ')</h4>';
    inEdges.forEach(e => {
      const src = GRAPH_DATA.nodes.find(n => n.id === e.from);
      if (src) html += '<div class="link-item" onclick="focusNode(\'' + e.from + '\')">' + src.title + ' <span style="color:#8b949e;font-size:10px;">(' + (e.type || 'relates-to') + ')</span></div>';
    });
    html += '</div>';
  }

  if (outEdges.length > 0) {
    html += '<div class="detail-section"><h4>References (' + outEdges.length + ')</h4>';
    outEdges.forEach(e => {
      const tgt = GRAPH_DATA.nodes.find(n => n.id === e.to);
      if (tgt) html += '<div class="link-item" onclick="focusNode(\'' + e.to + '\')">' + tgt.title + ' <span style="color:#8b949e;font-size:10px;">(' + (e.type || 'relates-to') + ')</span></div>';
    });
    html += '</div>';
  }

  content.innerHTML = html;
  panel.classList.add('visible');
}

function closeDetail() {
  document.getElementById('detail-panel').classList.remove('visible');
}

function focusNode(id) {
  const node = nodeElements.data().find(n => n.id === id);
  if (node) {
    svg.transition().duration(500).call(
      d3.zoom().scaleExtent([0.1, 4]).on('zoom', (event) => g.attr('transform', event.transform)).transform,
      d3.zoomIdentity.translate(400, 300).scale(1.5).translate(-node.x, -node.y)
    );
    showDetail(node);
  }
}

function toggleType(type, checked) {
  if (checked) activeTypes.add(type);
  else activeTypes.delete(type);
  renderGraph();
}

function resetZoom() {
  svg.transition().duration(500).call(
    d3.zoom().scaleExtent([0.1, 4]).on('zoom', (event) => g.attr('transform', event.transform)).transform,
    d3.zoomIdentity
  );
}

function toggleLabels() {
  showLabels = !showLabels;
  nodeElements.selectAll('text').style('display', showLabels ? 'block' : 'none');
}

document.getElementById('search').addEventListener('input', function(e) {
  const query = e.target.value.toLowerCase();
  nodeElements.selectAll('circle')
    .attr('opacity', d => !query || d.title.toLowerCase().includes(query) || d.id.toLowerCase().includes(query) ? 1 : 0.15);
  nodeElements.selectAll('text')
    .attr('opacity', d => !query || d.title.toLowerCase().includes(query) || d.id.toLowerCase().includes(query) ? 1 : 0.15);
});

init();
</script>
</body>
</html>`
  }
}
