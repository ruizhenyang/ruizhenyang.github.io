// Python字典美化工具 - 主要功能实现
class DictFormatter {
    constructor() {
        this.initElements();
        this.bindEvents();
        this.setupInitialData();
    }

    // 初始化DOM元素
    initElements() {
        this.inputArea = document.getElementById('inputArea');
        this.outputArea = document.getElementById('outputArea');
        this.clearBtn = document.getElementById('clearBtn');
        this.formatBtn = document.getElementById('formatBtn');
        this.copyBtn = document.getElementById('copyBtn');
        this.expandAllBtn = document.getElementById('expandAllBtn');
        this.collapseAllBtn = document.getElementById('collapseAllBtn');
    }

    // 绑定事件
    bindEvents() {
        // 实时输入监听
        this.inputArea.addEventListener('input', this.debounce(() => {
            this.formatInput();
        }, 300));

        // 格式化按钮点击事件
        this.formatBtn.addEventListener('click', () => this.formatInput());
        
        // 清空按钮事件
        this.clearBtn.addEventListener('click', () => this.clearInput());
        
        // 复制按钮事件
        this.copyBtn.addEventListener('click', () => this.copyOutput());
        
        // 展开/折叠按钮事件
        this.expandAllBtn.addEventListener('click', () => this.expandAll());
        this.collapseAllBtn.addEventListener('click', () => this.collapseAll());

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'Enter':
                        e.preventDefault();
                        this.formatInput();
                        break;
                    case 'l':
                        e.preventDefault();
                        this.clearInput();
                        break;
                }
            }
        });

        // 添加Tab键支持
        this.inputArea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = this.inputArea.selectionStart;
                const end = this.inputArea.selectionEnd;
                
                // 插入4个空格
                this.inputArea.value = this.inputArea.value.substring(0, start) + '    ' + this.inputArea.value.substring(end);
                this.inputArea.selectionStart = this.inputArea.selectionEnd = start + 4;
            }
        });
    }

    // 设置初始示例数据
    setupInitialData() {
        const exampleData = ``;
        this.inputArea.value = exampleData;
        this.formatInput();
    }

    // 防抖函数
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // 格式化输入
    formatInput() {
        const input = this.inputArea.value.trim();
        if (!input) {
            this.outputArea.innerHTML = '<p style="color: var(--text-secondary); text-align: center; margin-top: 100px;">请输入Python字典数据</p>';
            return;
        }

        try {
            // 尝试解析Python字典格式
            const parsedData = this.parsePythonDict(input);
            
            // 格式化右侧输出区域
            const formattedOutput = this.formatOutput(parsedData);
            this.outputArea.innerHTML = formattedOutput;
            
            // 绑定折叠事件
            this.bindCollapseEvents();
            
        } catch (error) {
            this.showError(`解析错误: ${error.message}`);
        }
    }

    // 解析Python字典格式
    parsePythonDict(input) {
        // 预处理：将Python语法转换为JSON兼容格式
        let processedInput = input
            .replace(/'/g, '"')  // 单引号转双引号
            .replace(/True/g, 'true')  // Python布尔值
            .replace(/False/g, 'false')
            .replace(/None/g, 'null')
            .replace(/(\w+):/g, '"$1":')  // 键名加引号
            .replace(/,(\s*[}\]])/g, '$1');  // 移除尾随逗号

        try {
            return JSON.parse(processedInput);
        } catch (e) {
            // 如果JSON解析失败，尝试更复杂的Python语法处理
            return this.parseComplexPythonDict(input);
        }
    }

    // 解析复杂Python字典语法
    parseComplexPythonDict(input) {
        // 这里可以实现更复杂的Python语法解析
        // 目前使用简化的方法
        throw new Error('不支持的Python字典格式，请使用标准格式');
    }

    // 格式化输出
    formatOutput(data, level = 0) {
        if (data === null) {
            return '<span class="dict-null">null</span>';
        }
        
        if (typeof data === 'boolean') {
            return `<span class="dict-boolean">${data}</span>`;
        }
        
        if (typeof data === 'number') {
            return `<span class="dict-number">${data}</span>`;
        }
        
        if (typeof data === 'string') {
            return `<span class="dict-string">"${this.escapeHtml(data)}"</span>`;
        }
        
        if (Array.isArray(data)) {
            return this.formatArray(data, level);
        }
        
        if (typeof data === 'object') {
            return this.formatObject(data, level);
        }
        
        return String(data);
    }

    // 格式化数组
    formatArray(array, level) {
        if (array.length === 0) {
            return '<span class="dict-bracket">[</span><span class="dict-bracket">]</span>';
        }

        const indent = '    '.repeat(level);
        const nextLevel = level + 1;
        const nextIndent = '    '.repeat(nextLevel);
        
        let html = '<span class="dict-bracket">[</span>';
        
        if (this.shouldCollapse(array, level)) {
            const id = this.generateId();
            html += `<span class="collapsible" data-target="${id}">`;
            html += `<span class="collapse-icon">▶</span>`;
            html += `<span class="dict-value">${array.length} 项</span>`;
            html += '</span>';
            html += `<div class="collapsible-content" id="${id}">`;
            
            array.forEach((item, index) => {
                html += `${nextIndent}${this.formatOutput(item, nextLevel)}`;
                if (index < array.length - 1) {
                    html += '<span class="dict-comma">,</span>';
                }
                html += '<br>';
            });
            
            html += `${indent}</div>`;
        } else {
            html += '<br>';
            array.forEach((item, index) => {
                html += `${nextIndent}${this.formatOutput(item, nextLevel)}`;
                if (index < array.length - 1) {
                    html += '<span class="dict-comma">,</span>';
                }
                html += '<br>';
            });
        }
        
        html += `${indent}<span class="dict-bracket">]</span>`;
        return html;
    }

    // 格式化对象
    formatObject(obj, level) {
        const keys = Object.keys(obj);
        if (keys.length === 0) {
            return '<span class="dict-bracket">{</span><span class="dict-bracket">}</span>';
        }

        const indent = '    '.repeat(level);
        const nextLevel = level + 1;
        const nextIndent = '    '.repeat(nextLevel);
        
        let html = '<span class="dict-bracket">{</span>';
        
        if (this.shouldCollapse(obj, level)) {
            const id = this.generateId();
            html += `<span class="collapsible" data-target="${id}">`;
            html += `<span class="collapse-icon">▶</span>`;
            html += `<span class="dict-value">${keys.length} 个键值对</span>`;
            html += '</span>';
            html += `<div class="collapsible-content" id="${id}">`;
            
            keys.forEach((key, index) => {
                html += `${nextIndent}<span class="dict-key">"${this.escapeHtml(key)}"</span>: `;
                html += this.formatOutput(obj[key], nextLevel);
                if (index < keys.length - 1) {
                    html += '<span class="dict-comma">,</span>';
                }
                html += '<br>';
            });
            
            html += `${indent}</div>`;
        } else {
            html += '<br>';
            keys.forEach((key, index) => {
                html += `${nextIndent}<span class="dict-key">"${this.escapeHtml(key)}"</span>: `;
                html += this.formatOutput(obj[key], nextLevel);
                if (index < keys.length - 1) {
                    html += '<span class="dict-comma">,</span>';
                }
                html += '<br>';
            });
        }
        
        html += `${indent}<span class="dict-bracket">}</span>`;
        return html;
    }

    // 判断是否应该折叠
    shouldCollapse(data, level) {
        if (level >= 2) return true;
        if (Array.isArray(data) && data.length > 3) return true;
        if (typeof data === 'object' && Object.keys(data).length > 3) return true;
        return false;
    }

    // 生成唯一ID
    generateId() {
        return 'collapse_' + Math.random().toString(36).substr(2, 9);
    }

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 绑定折叠事件
    bindCollapseEvents() {
        const collapsibles = document.querySelectorAll('.collapsible');
        collapsibles.forEach(collapsible => {
            collapsible.addEventListener('click', (e) => {
                const targetId = collapsible.getAttribute('data-target');
                const target = document.getElementById(targetId);
                const icon = collapsible.querySelector('.collapse-icon');
                
                if (target.classList.contains('collapsed')) {
                    target.classList.remove('collapsed');
                    icon.classList.remove('collapsed');
                } else {
                    target.classList.add('collapsed');
                    icon.classList.add('collapsed');
                }
            });
        });
    }

    // 展开全部
    expandAll() {
        const collapsedContents = document.querySelectorAll('.collapsible-content.collapsed');
        const collapsedIcons = document.querySelectorAll('.collapse-icon.collapsed');
        
        collapsedContents.forEach(content => content.classList.remove('collapsed'));
        collapsedIcons.forEach(icon => icon.classList.remove('collapsed'));
    }

    // 折叠全部
    collapseAll() {
        const allContents = document.querySelectorAll('.collapsible-content');
        const allIcons = document.querySelectorAll('.collapse-icon');
        
        allContents.forEach(content => content.classList.add('collapsed'));
        allIcons.forEach(icon => icon.classList.add('collapsed'));
    }

    // 清空输入
    clearInput() {
        this.inputArea.value = '';
        this.outputArea.innerHTML = '<p style="color: var(--text-secondary); text-align: center; margin-top: 100px;">请输入Python字典数据</p>';
        this.inputArea.focus();
    }

    // 复制输出
    copyOutput() {
        const outputText = this.outputArea.innerText;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(outputText).then(() => {
                this.showSuccess('已复制到剪贴板');
            }).catch(() => {
                this.fallbackCopy(outputText);
            });
        } else {
            this.fallbackCopy(outputText);
        }
    }

    // 备用复制方法
    fallbackCopy(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            this.showSuccess('已复制到剪贴板');
        } catch (err) {
            this.showError('复制失败');
        }
        document.body.removeChild(textArea);
    }

    // 显示成功消息
    showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = message;
        
        this.outputArea.insertBefore(successDiv, this.outputArea.firstChild);
        
        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }

    // 显示错误消息
    showError(message) {
        this.outputArea.innerHTML = `
            <div style="color: var(--error-color); text-align: center; margin-top: 100px; padding: 20px;">
                <h3>❌ 解析失败</h3>
                <p>${message}</p>
                <p style="font-size: 0.9em; margin-top: 10px; color: var(--text-secondary);">
                    请检查输入格式是否正确
                </p>
            </div>
            <div style="margin-top: 20px; padding: 20px; background: #F8F9FA; border-radius: 8px; border: 1px solid #E9ECEF;">
                <h4 style="margin-bottom: 10px; color: var(--text-primary);">💡 支持的格式示例：</h4>
                <pre style="background: #FFFFFF; padding: 15px; border-radius: 6px; border: 1px solid #DEE2E6; overflow-x: auto; font-size: 12px; line-height: 1.4;">
{
    "name": "张三",
    "age": 25,
    "hobbies": ["读书", "游泳"]
}</pre>
            </div>
        `;
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new DictFormatter();
});

// 添加一些额外的功能增强
document.addEventListener('DOMContentLoaded', () => {
    // 添加键盘导航提示
    const helpText = document.createElement('div');
    helpText.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 12px;
        opacity: 0.8;
        transition: opacity 0.3s;
        z-index: 1000;
    `;
    helpText.innerHTML = `
        <strong>快捷键:</strong><br>
        Ctrl+Enter: 格式化<br>
        Ctrl+L: 清空<br>
    `;
    
    helpText.addEventListener('mouseenter', () => helpText.style.opacity = '1');
    helpText.addEventListener('mouseleave', () => helpText.style.opacity = '0.8');
    
    document.body.appendChild(helpText);
    
    // 5秒后自动隐藏
    setTimeout(() => {
        helpText.style.opacity = '0';
        setTimeout(() => helpText.remove(), 300);
    }, 5000);
});
