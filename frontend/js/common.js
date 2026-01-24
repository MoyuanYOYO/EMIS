// frontend/js/common.js - 公共工具函数
// 这个文件包含所有页面都会用到的通用函数

const API_BASE = '/api';

// ==================== 消息显示功能 ====================

/**
 * 显示消息提示
 * @param {string} message - 要显示的消息内容
 * @param {string} type - 消息类型: 'success', 'danger', 'warning', 'info'
 */
function showMessage(message, type = 'info') {
    // 创建消息元素
    const messageDiv = document.createElement('div');
    messageDiv.className = `alert alert-${type} alert-dismissible fade show mt-3`;
    messageDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    // 尝试添加到页面合适的位置
    let container = document.querySelector('.container');
    if (!container) {
        container = document.querySelector('.container-fluid');
    }
    if (!container) {
        container = document.body;
    }

    if (container) {
        // 添加到容器顶部
        container.prepend(messageDiv);

        // 3秒后自动消失（如果是success或info类型）
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.remove();
                }
            }, 3000);
        }
    }
}

// ==================== API调用功能 ====================

/**
 * 统一的API调用函数
 * @param {string} endpoint - API端点，如 '/auth/login'
 * @param {object} options - fetch选项
 * @returns {Promise<object>} 响应数据
 */
async function callAPI(endpoint, options = {}) {
    try {
        // 设置默认请求头
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
        };

        // 合并选项
        const fetchOptions = { ...defaultOptions, ...options };

        // 如果是POST/PUT/PATCH请求，确保body是JSON字符串
        if (fetchOptions.body && typeof fetchOptions.body !== 'string') {
            fetchOptions.body = JSON.stringify(fetchOptions.body);
        }

        // 发起请求
        const response = await fetch(`${API_BASE}${endpoint}`, fetchOptions);

        // 尝试解析JSON响应
        let data;
        try {
            data = await response.json();
        } catch (e) {
            data = { error: '响应格式错误' };
        }

        // 如果响应不成功，显示错误消息
        if (!response.ok) {
            const errorMsg = data.error || data.message || `请求失败 (${response.status})`;
            showMessage(errorMsg, 'danger');
            return {
                success: false,
                data: data,
                status: response.status
            };
        }

        return {
            success: true,
            data: data,
            status: response.status
        };

    } catch (error) {
        console.error('API调用失败:', error);
        showMessage('网络错误，请检查连接或稍后重试', 'danger');
        return {
            success: false,
            data: null,
            status: 0,
            error: error.message
        };
    }
}

// ==================== 工具函数 ====================

/**
 * 格式化日期字符串
 * @param {string} dateString - ISO日期字符串
 * @returns {string} 格式化后的日期
 */
function formatDate(dateString) {
    if (!dateString) return '';

    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;

        // 格式: YYYY年MM月DD日 HH:MM
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${year}年${month}月${day}日 ${hours}:${minutes}`;
    } catch (error) {
        console.error('日期格式化错误:', error);
        return dateString;
    }
}

/**
 * 检查用户是否已登录
 * @returns {Promise<boolean>} 是否已登录
 */
async function checkLoginStatus() {
    try {
        const response = await callAPI('/auth/current-user');
        return response.success && response.data && !response.data.error;
    } catch (error) {
        return false;
    }
}

/**
 * 获取当前登录用户信息
 * @returns {Promise<object|null>} 用户信息或null
 */
async function getCurrentUser() {
    try {
        const response = await callAPI('/auth/current-user');
        if (response.success && response.data && !response.data.error) {
            return response.data;
        }
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * 用户注销
 */
async function logout() {
    try {
        const response = await callAPI('/auth/logout', { method: 'GET' });
        if (response.success) {
            // 清除本地存储（如果有的话）
            localStorage.removeItem('userInfo');
            sessionStorage.removeItem('userInfo');

            // 跳转到首页
            window.location.href = '/';
        }
    } catch (error) {
        console.error('注销失败:', error);
        // 即使API调用失败，也清除本地状态并跳转
        localStorage.removeItem('userInfo');
        sessionStorage.removeItem('userInfo');
        window.location.href = '/';
    }
}

/**
 * 防抖函数，用于减少频繁调用
 * @param {Function} func - 要执行的函数
 * @param {number} delay - 延迟时间(ms)
 * @returns {Function} 防抖后的函数
 */
function debounce(func, delay = 300) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

/**
 * 节流函数，用于控制函数执行频率
 * @param {Function} func - 要执行的函数
 * @param {number} limit - 时间限制(ms)
 * @returns {Function} 节流后的函数
 */
function throttle(func, limit = 300) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * 验证电子邮件格式
 * @param {string} email - 电子邮件地址
 * @returns {boolean} 是否有效
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * 验证手机号格式（中国）
 * @param {string} phone - 手机号码
 * @returns {boolean} 是否有效
 */
function isValidPhone(phone) {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone);
}

/**
 * 显示加载动画
 * @param {HTMLElement} element - 要显示动画的元素
 * @param {string} message - 加载消息
 */
function showLoading(element, message = '加载中...') {
    if (!element) return;

    element.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">加载中...</span>
            </div>
            <p class="mt-2">${message}</p>
        </div>
    `;
    element.classList.add('loading');
}

/**
 * 隐藏加载动画
 * @param {HTMLElement} element - 要隐藏动画的元素
 */
function hideLoading(element) {
    if (!element) return;
    element.classList.remove('loading');
}

/**
 * 安全地设置元素内容，防止XSS攻击
 * @param {HTMLElement} element - 目标元素
 * @param {string} content - 要设置的内容
 */
function setSafeHTML(element, content) {
    if (!element) return;
    element.textContent = content; // 使用textContent而不是innerHTML来防止XSS
}

// ==================== 本地存储操作 ====================

/**
 * 保存数据到本地存储
 * @param {string} key - 存储键名
 * @param {any} value - 存储值
 */
function saveToLocalStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error('保存到本地存储失败:', error);
    }
}

/**
 * 从本地存储读取数据
 * @param {string} key - 存储键名
 * @returns {any} 存储的值
 */
function getFromLocalStorage(key) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch (error) {
        console.error('从本地存储读取失败:', error);
        return null;
    }
}

/**
 * 从本地存储删除数据
 * @param {string} key - 存储键名
 */
function removeFromLocalStorage(key) {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.error('从本地存储删除失败:', error);
    }
}

// ==================== 权限检查 ====================

/**
 * 检查当前用户是否有指定角色
 * @param {string|string[]} roles - 允许的角色或角色数组
 * @returns {Promise<boolean>} 是否有权限
 */
async function hasRole(roles) {
    const user = await getCurrentUser();
    if (!user) return false;

    if (Array.isArray(roles)) {
        return roles.includes(user.role);
    }

    return user.role === roles;
}

/**
 * 检查当前用户是否有指定权限（简单版本）
 * @param {string} requiredRole - 需要的角色
 * @returns {Promise<boolean>} 是否有权限
 */
async function checkPermission(requiredRole) {
    const user = await getCurrentUser();
    if (!user) return false;

    // 简单的角色权限检查
    const roleHierarchy = {
        'admin': ['admin', 'teacher', 'student'],
        'teacher': ['teacher', 'student'],
        'student': ['student']
    };

    return roleHierarchy[user.role]?.includes(requiredRole) || false;
}

// ==================== 页面工具 ====================

/**
 * 获取URL查询参数
 * @param {string} name - 参数名
 * @returns {string|null} 参数值
 */
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

/**
 * 设置URL查询参数（不刷新页面）
 * @param {object} params - 参数对象
 */
function setUrlParameters(params) {
    const url = new URL(window.location);
    Object.keys(params).forEach(key => {
        url.searchParams.set(key, params[key]);
    });
    window.history.pushState({}, '', url);
}

/**
 * 滚动到页面顶部
 */
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * 复制文本到剪贴板
 * @param {string} text - 要复制的文本
 * @returns {Promise<boolean>} 是否成功
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showMessage('已复制到剪贴板', 'success');
        return true;
    } catch (error) {
        console.error('复制失败:', error);
        showMessage('复制失败，请手动复制', 'warning');
        return false;
    }
}

// ==================== 导出函数 ====================

// 将函数附加到window对象，以便在HTML中直接使用
window.Common = {
    API_BASE,
    showMessage,
    callAPI,
    formatDate,
    checkLoginStatus,
    getCurrentUser,
    logout,
    debounce,
    throttle,
    isValidEmail,
    isValidPhone,
    showLoading,
    hideLoading,
    setSafeHTML,
    saveToLocalStorage,
    getFromLocalStorage,
    removeFromLocalStorage,
    hasRole,
    checkPermission,
    getUrlParameter,
    setUrlParameters,
    scrollToTop,
    copyToClipboard
};

// 为了兼容性，也导出一些常用函数的简写
window.showMessage = showMessage;
window.callAPI = callAPI;
window.formatDate = formatDate;