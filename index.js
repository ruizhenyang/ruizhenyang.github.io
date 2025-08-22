let pyodide = null;
const els = {
  input: document.getElementById('inputArea'),
  output: document.getElementById('outputArea'),
  leftStatus: document.getElementById('leftStatus'),
  rightStatus: document.getElementById('rightStatus'),
  btnFormat: document.getElementById('formatBtn'),
  btnCopy: document.getElementById('copyBtn'),
  btnDownload: document.getElementById('downloadBtn'),
  indent: document.getElementById('indent'),
  sortKeys: document.getElementById('sortKeys'),
  modeRadios: () => document.querySelector('input[name="mode"]:checked'),
  samplePy: document.getElementById('samplePy'),
  sampleJson: document.getElementById('sampleJson'),
  clearBtn: document.getElementById('clearBtn'),
};

function setStatus(side, text, ok=false, err=false) {
  const el = side === 'left' ? els.leftStatus : els.rightStatus;
  el.textContent = text;
  el.className = 'status' + (ok ? ' ok' : '') + (err ? ' err' : '');
}

async function boot() {
  try {
    setStatus('left', 'Pyodide 加载中…');
    pyodide = await loadPyodide({ stdout:()=>{}, stderr:()=>{} });
    // 预热：导入标准库模块
    pyodide.runPython(`
import json, ast, pprint
def _warmup(): return True
_warmup()
`);
    setStatus('left', 'Pyodide 就绪', true, false);
    els.btnFormat.disabled = false;
  } catch (e) {
    setStatus('left', 'Pyodide 加载失败：' + (e && e.message ? e.message : e), false, true);
    els.btnFormat.disabled = true;
  }
}

async function formatNow() {
  if (!pyodide) return;
  const input_str = els.input.value;
  const indent = parseInt(els.indent.value || '2', 10);
  const sort_keys = !!els.sortKeys.checked;
  const mode = els.modeRadios().value; // 'json' | 'python'
  if (!input_str.trim()) {
    els.output.textContent = '';
    setStatus('right', '请输入内容…');
    return;
  }
  els.btnFormat.disabled = true;
  setStatus('right', '解析与格式化中…');

  // 将参数注入到 Python 运行环境，避免字符串拼接注入问题
  self.input_str = input_str;
  self._indent = indent;
  self._sort_keys = sort_keys;
  self._mode = mode;

  const code = `
import json, ast, pprint
from js import input_str, _indent, _sort_keys, _mode

def parse_input(s: str):
    s = s.strip()
    # 先尝试 JSON（允许 true/false/null 等）
    try:
        return json.loads(s)
    except Exception:
        pass
    # 再尝试 Python 字面量（支持 True/False/None，单引号、元组等）
    try:
        return ast.literal_eval(s)
    except Exception as e:
        raise ValueError(f"无法解析为 JSON 或 Python 字典：{e}")

obj = parse_input(input_str)

if _mode == "json":
    # JSON 输出：支持中文不转义、可选排序、缩进
    _result = json.dumps(obj, ensure_ascii=False, indent=int(_indent), sort_keys=bool(_sort_keys))
else:
    # Python 输出：pprint 格式化
    _result = pprint.pformat(obj, sort_dicts=bool(_sort_keys), indent=int(_indent), width=80, compact=False)

_result
`;

  try {
    const pretty = await pyodide.runPythonAsync(code);
    els.output.textContent = pretty;
    setStatus('right', '格式化完成', true, false);
  } catch (err) {
    const msg = (err && err.message) ? err.message : String(err);
    els.output.textContent = '';
    setStatus('right', '❌ 解析失败：' + msg, false, true);
  } finally {
    els.btnFormat.disabled = false;
  }
}

// 事件绑定
els.btnFormat.addEventListener('click', formatNow);
els.input.addEventListener('input', debounce(formatNow, 300));
els.indent.addEventListener('change', formatNow);
els.sortKeys.addEventListener('change', formatNow);
document.addEventListener('keydown', (e) => {
  const mac = navigator.platform.toLowerCase().includes('mac');
  if ((mac ? e.metaKey : e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    formatNow();
  }
});

els.btnCopy.addEventListener('click', async () => {
  const txt = els.output.textContent || '';
  if (!txt) return;
  try { 
    await navigator.clipboard.writeText(txt); 
    setStatus('right', '已复制到剪贴板', true, false); 
  }
  catch { 
    setStatus('right', '复制失败，请手动复制', false, true); 
  }
});

els.btnDownload.addEventListener('click', () => {
  const txt = els.output.textContent || '';
  if (!txt) return;
  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'beautified.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// 示例与清空
els.samplePy.addEventListener('click', () => {
  els.input.value = `{
  'name': 'Rui',
  'age': 20,
  'website': 'https://ruizhenyang.github.io/',
  'bool': True,
  'none': None,
  'list': ['a','b','c'],
  'tuple': ('a','b','c'),
  'dict': {'a':1,'b':2,'c':3},
  'int': 1,
  'float': 1.0,
  'str': 'a',
}`;
  formatNow();
});

els.sampleJson.addEventListener('click', () => {
  els.input.value = `{
  "name": "Rui",
  "age": 20,
  "website": "https://ruizhenyang.github.io/",
  "bool": true,
  "none": null,
  "list": ["a","b","c"],
  "dict": {"a":1,"b":2,"c":3},
  "int": 1,
  "float": 1.5,
  "str": "a"
}`;
  formatNow();
});

els.clearBtn.addEventListener('click', () => {
  els.input.value = '';
  els.output.textContent = '';
  setStatus('right', '已清空');
});

function debounce(fn, wait=300) {
  let t = null;
  return function(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  boot();
});
