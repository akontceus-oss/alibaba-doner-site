(function () {
  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(p) { this.state = Object.assign({}, this.state, typeof p === 'function' ? p(this.state) : p); schedule(); }
    forceUpdate() { schedule(); }
  }
  window.DCLogic = DCLogic;
  var inst, tpl, root, queued = false;
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(function () { queued = false; paint(); }); } }
  var WHOLE = /^\s*\{\{([^}]+)\}\}\s*$/;
  function get(scope, path) {
    path = path.trim();
    if (path === 'true') return true; if (path === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(path)) return +path;
    var v = scope, parts = path.split('.');
    for (var i = 0; i < parts.length; i++) { if (v == null) return undefined; v = v[parts[i]]; }
    return v;
  }
  function interp(s, scope) { return s.replace(/\{\{([^}]+)\}\}/g, function (_, p) { var v = get(scope, p); return v == null ? '' : String(v); }); }
  function child(scope, extra) { var o = Object.create(scope); for (var k in extra) o[k] = extra[k]; return o; }
  function render(t, scope, out) {
    t.childNodes.forEach(function (n) {
      if (n.nodeType === 3) { out.appendChild(document.createTextNode(interp(n.nodeValue, scope))); return; }
      if (n.nodeType !== 1) return;
      var tag = n.localName;
      if (tag === 'helmet') return;
      if (tag === 'sc-for') {
        var list = get(scope, n.getAttribute('list').match(WHOLE)[1]) || [], as = n.getAttribute('as');
        list.forEach(function (it, i) { var e = {}; e[as] = it; e.$index = i; render(n, child(scope, e), out); });
        return;
      }
      if (tag === 'sc-if') { if (get(scope, n.getAttribute('value').match(WHOLE)[1])) render(n, scope, out); return; }
      var el = n.namespaceURI === 'http://www.w3.org/1999/xhtml' ? document.createElement(tag) : document.createElementNS(n.namespaceURI, n.tagName);
      Array.prototype.forEach.call(n.attributes, function (a) {
        var m = a.value.match(WHOLE);
        if (/^on[A-Z]/.test(a.name) || /^on/.test(a.name) && m) {
          var fn = m && get(scope, m[1]);
          if (typeof fn === 'function') el.addEventListener(a.name.slice(2).toLowerCase(), fn);
          return;
        }
        if (m) {
          var v = get(scope, m[1]);
          if (/^aria-|^data-/.test(a.name)) { if (v != null) el.setAttribute(a.name, String(v)); return; }
          if (v === false || v == null) return;
          el.setAttribute(a.name, v === true ? '' : String(v));
          return;
        }
        el.setAttribute(a.name, interp(a.value, scope));
      });
      render(n.localName === 'template' ? n.content : n, scope, el);
      out.appendChild(el);
    });
  }
  function paint() {
    var f = document.createDocumentFragment();
    render(tpl, inst.renderVals ? inst.renderVals() : {}, f);
    root.replaceChildren(f);
  }
  document.addEventListener('DOMContentLoaded', function () {
    var x = document.querySelector('x-dc');
    var h = x.querySelector('helmet');
    if (h) Array.prototype.slice.call(h.children).forEach(function (c) { document.head.appendChild(c); });
    tpl = x; root = document.createElement('div');
    x.parentNode.insertBefore(root, x); x.remove();
    var s = document.querySelector('script[data-dc-script]');
    var props = {};
    try { var d = JSON.parse(s.getAttribute('data-props') || '{}'); for (var k in d) if (d[k] && 'default' in d[k]) props[k] = d[k]['default']; } catch (e) {}
    var C = window.__DCComponent;
    inst = new C(props);
    paint();
    if (inst.componentDidMount) inst.componentDidMount();
  });
})();
