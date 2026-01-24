// frontend/js/auth.js - 认证相关JavaScript

const API_BASE = '/api';

/**
 * 检查登录状态
 */
async function checkLoginStatus() {
    try {
        const response = await fetch(`${API_BASE}/auth/current-user`);
        if (response.ok) {
            return await response.json();
        }
        return null;
    } catch (error) {
        console.error('检查登录状态失败:', error);
        return null;
    }
}

/**
 * 用户登录
 */
async function login(username, password) {
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            // 登录成功，根据角色跳转
            if (data.role === 'student') {
                window.location.href = '/student/dashboard';
            } else if (data.role === 'teacher') {
                window.location.href = '/teacher/dashboard';
            } else if (data.role === 'admin') {
                window.location.href = '/admin/dashboard';
            } else {
                window.location.href = '/';
            }
        } else {
            // 显示错误信息
            showMessage(data.error || '登录失败', 'danger');
        }
    } catch (error) {
        console.error('登录请求失败:', error);
        showMessage('网络错误，请稍后重试', 'danger');
    }
}

/**
 * 用户注销
 */
async function logout() {
    try {
        const response = await fetch(`${API_BASE}/auth/logout`);
        if (response.ok) {
            window.location.href = '/';
        }
    } catch (error) {
        console.error('注销失败:', error);
        showMessage('注销失败，请重试', 'danger');
    }
}

/**
 * 显示消息
 */
function showMessage(message, type = 'info') {
    // 创建消息元素
    const messageDiv = document.createElement('div');
    messageDiv.className = `alert alert-${type} alert-dismissible fade show`;
    messageDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    // 添加到页面
    const container = document.querySelector('.container') || document.body;
    container.prepend(messageDiv);

    // 3秒后自动消失
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 3000);
}

/**
 * 页面初始化时检查登录状态
 */
document.addEventListener('DOMContentLoaded', async function () {
    // 检查是否在登录页面
    const currentPath = window.location.pathname;
    const isLoginPage = currentPath.includes('login') || currentPath === '/';

    if (!isLoginPage) {
        const user = await checkLoginStatus();
        if (!user) {
            // 未登录，跳转到登录页面
            window.location.href = '/login';
        }
    }
});

// 导出函数（如果使用模块）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { login, logout, checkLoginStatus };
}