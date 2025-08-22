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
import json, ast, pprint, re
from js import input_str, _indent, _sort_keys, _mode

def clean_json_string(s):
    """清理常见的JSON格式问题"""
    # 移除尾随逗号
    s = re.sub(r',(\s*[}\]])', r'\\1', s)
    # 移除空行
    s = re.sub(r'\\n\\s*\\n', '\\n', s)
    return s

def parse_input(s: str):
    s = s.strip()
    
    # 先尝试清理后的JSON
    try:
        cleaned = clean_json_string(s)
        return json.loads(cleaned)
    except Exception as json_error:
        pass
    
    # 再尝试原始JSON
    try:
        return json.loads(s)
    except json.JSONDecodeError as e:
        # 提供详细的JSON错误信息
        error_msg = str(e)
        if "Expecting ',' delimiter" in error_msg:
            raise ValueError("JSON格式错误：缺少逗号分隔符")
        elif "Expecting property name enclosed in double quotes" in error_msg:
            raise ValueError("JSON格式错误：属性名必须用双引号包围")
        elif "Expecting value" in error_msg:
            raise ValueError("JSON格式错误：属性值缺失")
        elif "Extra data" in error_msg:
            raise ValueError("JSON格式错误：存在多余字符")
        elif "Expecting ',' delimiter" in error_msg or "Expecting '}'" in error_msg:
            raise ValueError("JSON格式错误：可能是尾随逗号问题，请检查最后一个属性后是否有逗号")
        else:
            raise ValueError(f"JSON格式错误：{error_msg}")
    except Exception:
        pass
    
    # 最后尝试 Python 字面量（支持 True/False/None，单引号、元组等）
    try:
        return ast.literal_eval(s)
    except Exception as e:
        raise ValueError(f"无法解析为 JSON 或 Python 字典。\\n\\n常见问题：\\n1. 尾随逗号：最后一个属性后不能有逗号\\n2. 属性名必须用双引号包围\\n3. 字符串值必须用双引号包围\\n4. 布尔值使用 true/false（小写）\\n\\n原始错误：{e}")

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
  
  // 根据输出模式决定文件类型和扩展名
  const mode = els.modeRadios().value;
  const fileExt = mode === 'json' ? '.json' : '.txt';
  const mimeType = mode === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8';
  
  const blob = new Blob([txt], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `beautified${fileExt}`;
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
  'str': 'a'
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
  "float": 1.0,
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
