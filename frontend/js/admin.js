// frontend/js/admin.js - 管理员端功能模块
// 基于teacher.js架构，适配管理员功能
// 使用common.js中的函数：showMessage, callAPI, formatDate等

// ==================== 管理员模块主类 ====================
class AdminDashboard {
    constructor() {
        this.currentUser = null;
        this.currentPage = 'dashboard';
        this.users = [];
        this.students = [];
        this.teachers = [];
        this.courses = [];
        this.auditLogs = [];
        this.securityReport = null;

        console.log('AdminDashboard 初始化...');
    }

    // ==================== 辅助方法：数据格式处理 ====================

    /**
     * 从API响应中提取数据（处理多种格式）
     */
    extractData(response) {
        if (!response || !response.success) {
            console.warn('API响应不成功:', response);
            return null;
        }

        const data = response.data;

        // 如果已经是数组或对象，直接返回
        if (Array.isArray(data) || (data && typeof data === 'object')) {
            // 检查是否为 {success: true, data: [...]} 格式
            if (data.success !== undefined && data.data !== undefined) {
                return data.data;
            }
            return data;
        }

        console.warn('无法识别的数据格式:', data);
        return null;
    }

    // ==================== 初始化方法 ====================

    /**
     * 初始化管理员仪表板
     */
    async init() {
        try {
            console.log('开始初始化管理员仪表板...');

            // 1. 检查登录状态和权限
            await this.checkAuth();

            // 2. 获取当前用户信息
            this.currentUser = await this.getCurrentUserInfo();
            if (!this.currentUser) {
                console.error('无法获取用户信息');
                window.location.href = '/';
                return;
            }

            // 3. 验证是否为管理员
            if (this.currentUser.role !== 'admin') {
                showMessage('您没有管理员权限', 'danger');
                setTimeout(() => {
                    if (this.currentUser.role === 'student') {
                        window.location.href = '/student/dashboard';
                    } else if (this.currentUser.role === 'teacher') {
                        window.location.href = '/teacher/dashboard';
                    } else {
                        window.location.href = '/';
                    }
                }, 1500);
                return;
            }

            // 4. 更新UI显示
            this.updateUserDisplay();

            // 5. 绑定事件
            this.bindEvents();

            // 6. 加载默认页面
            await this.loadPage('dashboard');

            console.log('AdminDashboard 初始化完成');

        } catch (error) {
            console.error('初始化失败:', error);
            this.showError('初始化失败，请刷新页面重试');
        }
    }

    /**
     * 检查认证状态
     */
    async checkAuth() {
        console.log('检查认证状态...');
        const user = await getCurrentUser();
        if (!user) {
            showMessage('请先登录', 'warning');
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
            throw new Error('未登录');
        }
        console.log('认证通过，角色:', user.role);
        return true;
    }

    /**
     * 获取当前用户信息
     */
    async getCurrentUserInfo() {
        try {
            console.log('获取用户信息...');
            const response = await callAPI('/auth/current-user');
            console.log('用户信息响应:', response);

            if (response.success && response.data) {
                return response.data;
            }
            console.warn('获取用户信息失败:', response);
            return null;
        } catch (error) {
            console.error('获取用户信息失败:', error);
            return null;
        }
    }

    /**
     * 更新用户显示信息
     */
    updateUserDisplay() {
        const adminNameElement = document.getElementById('adminName');
        if (adminNameElement && this.currentUser) {
            adminNameElement.textContent = this.currentUser.name || this.currentUser.username || '管理员';
        }

        // 更新侧边栏信息
        this.updateSidebarInfo();
    }

    /**
     * 更新侧边栏信息
     */
    updateSidebarInfo() {
        if (this.currentUser) {
            const sidebarName = document.getElementById('sidebarAdminName');
            const sidebarId = document.getElementById('sidebarAdminId');
            const sidebarRole = document.getElementById('sidebarAdminRole');

            if (sidebarName) sidebarName.textContent = this.currentUser.name || this.currentUser.username;
            if (sidebarId) sidebarId.textContent = this.currentUser.user_id;
            if (sidebarRole) sidebarRole.textContent = '管理员';
        }
    }

    // ==================== 事件绑定 ====================

    /**
     * 绑定所有事件
     */
    bindEvents() {
        console.log('绑定事件...');

        // 侧边栏按钮事件
        const sidebarButtons = document.querySelectorAll('#sidebarMenu button[data-page]');
        sidebarButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const page = e.target.dataset.page;
                console.log('点击侧边栏按钮:', page);
                this.loadPage(page);

                // 更新按钮激活状态
                this.updateSidebarActiveState(e.target);
            });
        });

        // 注销按钮事件
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }

        console.log('事件绑定完成');
    }

    /**
     * 更新侧边栏激活状态
     */
    updateSidebarActiveState(activeButton) {
        const sidebarButtons = document.querySelectorAll('#sidebarMenu button[data-page]');
        sidebarButtons.forEach(button => {
            button.classList.remove('active', 'btn-primary');
            button.classList.add('btn-outline-primary');
        });

        if (activeButton) {
            activeButton.classList.remove('btn-outline-primary');
            activeButton.classList.add('active', 'btn-primary');
        }
    }

    // ==================== 页面加载和导航 ====================

    /**
     * 加载页面
     */
    async loadPage(page) {
        console.log('加载页面:', page);
        this.currentPage = page;
        const mainContent = document.getElementById('mainContent');

        if (!mainContent) {
            console.error('找不到主内容区域');
            return;
        }

        // 显示加载状态
        mainContent.innerHTML = this.createLoadingHTML();

        try {
            switch (page) {
                case 'dashboard':
                    await this.loadDashboard();
                    break;
                case 'users':
                    await this.loadUsers();
                    break;
                case 'students':
                    await this.loadStudents();
                    break;
                case 'teachers':
                    await this.loadTeachers();
                    break;
                case 'courses':
                    await this.loadCourses();
                    break;
                case 'audit':
                    await this.loadAuditLogs();
                    break;
                case 'security':
                    await this.loadSecurity();
                    break;
                default:
                    await this.loadDashboard();
            }
            console.log('页面加载完成:', page);
        } catch (error) {
            console.error(`加载页面 ${page} 失败:`, error);
            this.showError('加载页面失败，请刷新重试: ' + error.message);
        }
    }

    /**
     * 创建加载中HTML
     */
    createLoadingHTML(message = '加载中...') {
        return `
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">加载中...</span>
                </div>
                <p class="mt-3">${message}</p>
            </div>
        `;
    }

    /**
     * 显示错误页面
     */
    showError(message) {
        const mainContent = document.getElementById('mainContent');
        if (!mainContent) return;

        mainContent.innerHTML = `
            <div class="alert alert-danger">
                <h5 class="alert-heading">错误</h5>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="adminDashboard.loadPage('dashboard')">
                    返回首页
                </button>
                <button class="btn btn-secondary ms-2" onclick="location.reload()">
                    刷新页面
                </button>
            </div>
        `;
    }

    // ==================== 仪表板页面 ====================

    /**
     * 加载仪表板页面
     */
    async loadDashboard() {
        console.log('加载管理员仪表板...');
        const response = await callAPI('/admin/dashboard-stats');

        if (!response.success) {
            this.showError('获取仪表板数据失败');
            return;
        }

        const stats = this.extractData(response);
        const mainContent = document.getElementById('mainContent');

        mainContent.innerHTML = `
            <h4 class="mb-4">管理员仪表板</h4>
            
            <div class="alert alert-primary">
                <strong>👨‍💼 欢迎回来，${this.currentUser.name || this.currentUser.username}管理员！</strong>
                <p class="mb-0 mt-2">请使用侧边栏菜单管理系统功能。</p>
            </div>
            
            <div class="row mt-4">
                <!-- 用户统计 -->
                <div class="col-md-3 col-sm-6 mb-4">
                    <div class="card h-100">
                        <div class="card-header bg-primary text-white">
                            <h5 class="mb-0">👤 用户统计</h5>
                        </div>
                        <div class="card-body">
                            <div class="text-center">
                                <h2 class="display-6">${stats?.user_stats?.total || 0}</h2>
                                <p class="text-muted mb-0">总用户数</p>
                            </div>
                            <hr>
                            <div class="row text-center">
                                <div class="col-6">
                                    <h6>${stats?.user_stats?.students || 0}</h6>
                                    <small class="text-muted">学生</small>
                                </div>
                                <div class="col-6">
                                    <h6>${stats?.user_stats?.teachers || 0}</h6>
                                    <small class="text-muted">教师</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 学生统计 -->
                <div class="col-md-3 col-sm-6 mb-4">
                    <div class="card h-100">
                        <div class="card-header bg-success text-white">
                            <h5 class="mb-0">🎓 学生统计</h5>
                        </div>
                        <div class="card-body">
                            <div class="text-center">
                                <h2 class="display-6">${stats?.student_stats?.total || 0}</h2>
                                <p class="text-muted mb-0">总学生数</p>
                            </div>
                            <hr>
                            <div class="row text-center">
                                <div class="col-6">
                                    <h6>${stats?.student_stats?.active || 0}</h6>
                                    <small class="text-muted">在读</small>
                                </div>
                                <div class="col-6">
                                    <h6>${stats?.student_stats?.graduated || 0}</h6>
                                    <small class="text-muted">已毕业</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 课程统计 -->
                <div class="col-md-3 col-sm-6 mb-4">
                    <div class="card h-100">
                        <div class="card-header bg-info text-white">
                            <h5 class="mb-0">📚 课程统计</h5>
                        </div>
                        <div class="card-body">
                            <div class="text-center">
                                <h2 class="display-6">${stats?.course_stats?.total || 0}</h2>
                                <p class="text-muted mb-0">总课程数</p>
                            </div>
                            <hr>
                            <div class="row text-center">
                                <div class="col-12">
                                    <h6>${stats?.course_stats?.current || 0}</h6>
                                    <small class="text-muted">本学期课程</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 选课统计 -->
                <div class="col-md-3 col-sm-6 mb-4">
                    <div class="card h-100">
                        <div class="card-header bg-warning text-white">
                            <h5 class="mb-0">📝 选课统计</h5>
                        </div>
                        <div class="card-body">
                            <div class="text-center">
                                <h2 class="display-6">${stats?.enrollment_stats?.total || 0}</h2>
                                <p class="text-muted mb-0">总选课数</p>
                            </div>
                            <hr>
                            <div class="row text-center">
                                <div class="col-6">
                                    <h6>${stats?.enrollment_stats?.active || 0}</h6>
                                    <small class="text-muted">在读</small>
                                </div>
                                <div class="col-6">
                                    <h6>${stats?.enrollment_stats?.completed || 0}</h6>
                                    <small class="text-muted">已完成</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 快速操作 -->
            <div class="row mt-2">
                <div class="col-md-12">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0">🚀 快速操作</h5>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-3 col-sm-6 mb-3">
                                    <button class="btn btn-outline-primary w-100" onclick="adminDashboard.loadPage('users')">
                                        <i class="bi bi-people"></i><br>
                                        用户管理
                                    </button>
                                </div>
                                <div class="col-md-3 col-sm-6 mb-3">
                                    <button class="btn btn-outline-success w-100" onclick="adminDashboard.loadPage('students')">
                                        <i class="bi bi-mortarboard"></i><br>
                                        学生管理
                                    </button>
                                </div>
                                <div class="col-md-3 col-sm-6 mb-3">
                                    <button class="btn btn-outline-info w-100" onclick="adminDashboard.loadPage('teachers')">
                                        <i class="bi bi-person-badge"></i><br>
                                        教师管理
                                    </button>
                                </div>
                                <div class="col-md-3 col-sm-6 mb-3">
                                    <button class="btn btn-outline-warning w-100" onclick="adminDashboard.loadPage('security')">
                                        <i class="bi bi-shield-check"></i><br>
                                        安全监控
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 系统公告 -->
            <div class="card mt-4">
                <div class="card-header">
                    <h5 class="mb-0">📢 系统公告</h5>
                </div>
                <div class="card-body">
                    <div class="alert alert-light border">
                        <p class="mb-1"><strong>🛡️ 数据安全提醒</strong></p>
                        <p class="mb-0">系统使用AES-256加密敏感数据，SHA-256哈希保护成绩完整性。请定期检查安全状态。</p>
                    </div>
                    <div class="alert alert-light border mt-2">
                        <p class="mb-1"><strong>📊 数据统计</strong></p>
                        <p class="mb-0">今日操作日志：${stats?.audit_stats?.today || 0}条，总操作日志：${stats?.audit_stats?.total || 0}条。</p>
                    </div>
                </div>
            </div>
            
            <!-- 近期操作日志 -->
            <div class="row mt-4">
                <div class="col-md-12">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h5 class="mb-0">📋 近期操作日志</h5>
                            <button class="btn btn-sm btn-outline-primary" onclick="adminDashboard.loadPage('audit')">
                                查看全部
                            </button>
                        </div>
                        <div class="card-body">
                            <div class="table-responsive">
                                <table class="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>时间</th>
                                            <th>用户</th>
                                            <th>操作类型</th>
                                            <th>结果</th>
                                        </tr>
                                    </thead>
                                    <tbody id="recentLogsBody">
                                        <tr>
                                            <td colspan="4" class="text-center">正在加载...</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 加载最近的操作日志
        await this.loadRecentLogs();
    }

    /**
     * 加载最近的操作日志
     */
    async loadRecentLogs() {
        try {
            const response = await callAPI('/admin/audit-logs?limit=5');
            if (response.success) {
                const data = this.extractData(response);
                const logs = data?.logs || [];
                const tbody = document.getElementById('recentLogsBody');

                if (logs.length === 0) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="4" class="text-center text-muted">暂无操作日志</td>
                        </tr>
                    `;
                    return;
                }

                tbody.innerHTML = logs.map(log => `
                    <tr>
                        <td>${formatDate(log.timestamp)}</td>
                        <td>${log.username || log.user_id}</td>
                        <td>${this.getActionTypeText(log.action_type)}</td>
                        <td>
                            <span class="badge ${log.result === 'success' ? 'bg-success' : 'bg-danger'}">
                                ${log.result === 'success' ? '成功' : '失败'}
                            </span>
                        </td>
                    </tr>
                `).join('');
            }
        } catch (error) {
            console.error('加载最近日志失败:', error);
        }
    }

    // ==================== 用户管理页面 ====================

    /**
     * 加载用户管理页面
     */
    async loadUsers() {
        console.log('加载用户管理...');
        const mainContent = document.getElementById('mainContent');

        // 先加载页面框架
        mainContent.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4>用户管理</h4>
                <div>
                    <button class="btn btn-primary" onclick="adminDashboard.showCreateUserModal()">
                        <i class="bi bi-plus-circle"></i> 创建用户
                    </button>
                    <button class="btn btn-outline-primary ms-2" onclick="adminDashboard.loadPage('users')">
                        <i class="bi bi-arrow-clockwise"></i> 刷新
                    </button>
                </div>
            </div>
            
            <!-- 筛选工具栏 -->
            <div class="card mb-4">
                <div class="card-body">
                    <div class="row g-3">
                        <div class="col-md-3">
                            <select class="form-select" id="filterRole" onchange="adminDashboard.filterUsers()">
                                <option value="">所有角色</option>
                                <option value="student">学生</option>
                                <option value="teacher">教师</option>
                                <option value="admin">管理员</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <select class="form-select" id="filterStatus" onchange="adminDashboard.filterUsers()">
                                <option value="">所有状态</option>
                                <option value="active">活跃</option>
                                <option value="inactive">禁用</option>
                            </select>
                        </div>
                        <div class="col-md-6">
                            <div class="input-group">
                                <input type="text" class="form-control" id="userSearch" 
                                       placeholder="搜索用户名或用户ID..." 
                                       onkeyup="adminDashboard.filterUsers()">
                                <button class="btn btn-outline-secondary" type="button" onclick="adminDashboard.filterUsers()">
                                    <i class="bi bi-search"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 用户表格 -->
            <div class="table-responsive" id="userTableContainer">
                <div class="text-center py-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">加载中...</span>
                    </div>
                    <p class="mt-3">正在加载用户数据...</p>
                </div>
            </div>
        `;

        // 加载用户数据
        await this.loadUserData();
    }

    /**
     * 加载用户数据
     */
    async loadUserData() {
        try {
            const response = await callAPI('/admin/users');
            if (!response.success) {
                showMessage('获取用户列表失败: ' + (response.error || '未知错误'), 'danger');
                return;
            }

            this.users = this.extractData(response) || [];
            this.renderUserTable();
        } catch (error) {
            console.error('加载用户数据失败:', error);
            showMessage('加载用户数据失败，请重试', 'danger');
        }
    }

    /**
     * 渲染用户表格
     */
    renderUserTable(filteredUsers = null) {
        const usersToRender = filteredUsers || this.users;
        const container = document.getElementById('userTableContainer');
        if (!container) return;
        if (usersToRender.length === 0) {
            container.innerHTML = `
                <div class="alert alert-warning">
                    <i class="bi bi-people"></i> 没有找到用户数据
                    <p class="mb-0 mt-2">点击"创建用户"按钮添加新用户。</p>
                </div>
            `;
            return;
        }
        container.innerHTML = `
            <table class="table table-hover">
                <thead class="table-light">
                    <tr>
                        <th>用户ID</th>
                        <th>用户名</th>
                        <th>角色</th>
                        <th>姓名</th>
                        <th>院系/专业</th>
                        <th>状态</th>
                        <th>最后登录</th>
                        <th>创建时间</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${usersToRender.map(user => `
                        <tr>
                            <td>${user.user_id}</td>
                            <td>${user.username}</td>
                            <td>
                                <span class="badge ${this.getRoleBadgeClass(user.role)}">
                                    ${this.getRoleText(user.role)}
                                </span>
                            </td>
                            <td>${user.name || '-'}</td>
                            <td>${user.department || user.major || '-'}</td>
                            <td>
                                <span class="badge ${user.status === 'active' ? 'bg-success' : 'bg-secondary'}">
                                    ${user.status === 'active' ? '活跃' : '禁用'}
                                </span>
                            </td>
                            <td>${user.last_login ? formatDate(user.last_login) : '从未登录'}</td>
                            <td>${user.created_at ? formatDate(user.created_at) : '-'}</td>
                            <td>
                                <div class="btn-group btn-group-sm" role="group">
                                    ${user.user_id !== this.currentUser?.user_id ? `
                                        ${user.status === 'active' ? `
                                            <button class="btn btn-outline-warning" onclick="adminDashboard.toggleUserStatus('${user.user_id}', 'inactive')" 
                                                    title="禁用用户">
                                                <i class="bi bi-pause-circle"></i>
                                            </button>
                                        ` : `
                                            <button class="btn btn-outline-success" onclick="adminDashboard.toggleUserStatus('${user.user_id}', 'active')" 
                                                    title="启用用户">
                                                <i class="bi bi-play-circle"></i>
                                            </button>
                                        `}
                                        <button class="btn btn-outline-primary" onclick="adminDashboard.showResetPasswordModal('${user.user_id}', '${user.username}')"
                                                title="重置密码">
                                            <i class="bi bi-key"></i>
                                        </button>
                                        <button class="btn btn-outline-danger" onclick="adminDashboard.showDeleteUserModal('${user.user_id}', '${user.username}')"
                                                title="删除用户">
                                            <i class="bi bi-trash"></i>
                                        </button>
                                    ` : `
                                        <button class="btn btn-outline-warning" onclick="adminDashboard.showChangePasswordModal()"
                                                title="修改自己的密码">
                                            <i class="bi bi-key-fill"></i> 修改密码
                                        </button>
                                        <span class="text-muted ms-2">当前用户</span>
                                    `}
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="alert alert-info mt-3">
                <i class="bi bi-info-circle"></i> 共 ${usersToRender.length} 个用户
            </div>
        `;
    }

    /**
     * 筛选用户
     */
    filterUsers() {
        const role = document.getElementById('filterRole').value;
        const status = document.getElementById('filterStatus').value;
        const keyword = document.getElementById('userSearch').value.toLowerCase().trim();

        const filteredUsers = this.users.filter(user => {
            // 按角色筛选
            if (role && user.role !== role) return false;

            // 按状态筛选
            if (status && user.status !== status) return false;

            // 按关键词筛选
            if (keyword) {
                const searchFields = [
                    user.user_id,
                    user.username,
                    user.name,
                    user.department,
                    user.major
                ].filter(field => field);

                return searchFields.some(field =>
                    field.toLowerCase().includes(keyword)
                );
            }

            return true;
        });

        this.renderUserTable(filteredUsers);
    }

    /**
     * 显示创建用户模态框
     */
    showCreateUserModal() {
        const modalHTML = `
            <div class="modal fade" id="createUserModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">创建新用户</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="createUserForm">
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">用户ID <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" id="newUserId" required 
                                               placeholder="学号或工号，如：20230001">
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">用户名 <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" id="newUsername" required 
                                               placeholder="登录用户名，至少3位">
                                    </div>
                                </div>
                                
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">密码 <span class="text-danger">*</span></label>
                                        <input type="password" class="form-control" id="newPassword" required 
                                               placeholder="至少6位字符" value="123456">
                                        <div class="form-text">默认密码：123456，建议用户首次登录后修改</div>
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">角色 <span class="text-danger">*</span></label>
                                        <select class="form-select" id="newUserRole" required>
                                            <option value="student">学生</option>
                                            <option value="teacher">教师</option>
                                            <option value="admin">管理员</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <!-- 根据角色显示不同字段 -->
                                <div id="studentFields" class="mb-3">
                                    <h6 class="border-bottom pb-2 mb-3">学生信息</h6>
                                    <div class="row">
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">姓名</label>
                                            <input type="text" class="form-control" id="newStudentName">
                                        </div>
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">邮箱</label>
                                            <input type="email" class="form-control" id="newStudentEmail">
                                        </div>
                                    </div>
                                    <div class="row">
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">院系</label>
                                            <input type="text" class="form-control" id="newStudentDepartment">
                                        </div>
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">专业</label>
                                            <input type="text" class="form-control" id="newStudentMajor">
                                        </div>
                                    </div>
                                    <div class="row">
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">身份证号</label>
                                            <input type="text" class="form-control" id="newStudentIdCard" 
                                                   placeholder="18位身份证号">
                                        </div>
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">手机号</label>
                                            <input type="text" class="form-control" id="newStudentPhone" 
                                                   placeholder="11位手机号">
                                        </div>
                                    </div>
                                </div>
                                
                                <div id="teacherFields" class="mb-3" style="display: none;">
                                    <h6 class="border-bottom pb-2 mb-3">教师信息</h6>
                                    <div class="row">
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">姓名</label>
                                            <input type="text" class="form-control" id="newTeacherName">
                                        </div>
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">职称</label>
                                            <input type="text" class="form-control" id="newTeacherTitle">
                                        </div>
                                    </div>
                                    <div class="row">
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">院系</label>
                                            <input type="text" class="form-control" id="newTeacherDepartment">
                                        </div>
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">邮箱</label>
                                            <input type="email" class="form-control" id="newTeacherEmail">
                                        </div>
                                    </div>
                                </div>
                                
                                <div id="adminFields" class="mb-3" style="display: none;">
                                    <div class="alert alert-info">
                                        <i class="bi bi-info-circle"></i> 
                                        管理员账户只需要基本信息，其他信息可后续补充。
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                            <button type="button" class="btn btn-primary" onclick="adminDashboard.createUser()">创建</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 添加模态框到页面
        const modalContainer = document.getElementById('modalContainer') || document.createElement('div');
        modalContainer.id = 'modalContainer';
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer);

        // 显示模态框
        const modal = new bootstrap.Modal(document.getElementById('createUserModal'));
        modal.show();

        // 根据角色切换显示字段
        document.getElementById('newUserRole').addEventListener('change', (e) => {
            const role = e.target.value;
            document.getElementById('studentFields').style.display = role === 'student' ? 'block' : 'none';
            document.getElementById('teacherFields').style.display = role === 'teacher' ? 'block' : 'none';
            document.getElementById('adminFields').style.display = role === 'admin' ? 'block' : 'none';
        });
    }

    /**
     * 创建用户
     */
    async createUser() {
        const userId = document.getElementById('newUserId').value.trim();
        const username = document.getElementById('newUsername').value.trim();
        const password = document.getElementById('newPassword').value;
        const role = document.getElementById('newUserRole').value;

        if (!userId || !username || !password) {
            showMessage('请填写所有必填字段', 'warning');
            return;
        }

        if (username.length < 3) {
            showMessage('用户名至少3个字符', 'warning');
            return;
        }

        if (password.length < 6) {
            showMessage('密码至少6个字符', 'warning');
            return;
        }

        const userData = {
            user_id: userId,
            username: username,
            password: password,
            role: role
        };

        // 根据角色添加额外信息
        if (role === 'student') {
            userData.name = document.getElementById('newStudentName').value.trim();
            userData.email = document.getElementById('newStudentEmail').value.trim();
            userData.department = document.getElementById('newStudentDepartment').value.trim();
            userData.major = document.getElementById('newStudentMajor').value.trim();
            userData.id_card = document.getElementById('newStudentIdCard').value.trim();
            userData.phone = document.getElementById('newStudentPhone').value.trim();
            userData.enrollment_year = new Date().getFullYear();
        } else if (role === 'teacher') {
            userData.name = document.getElementById('newTeacherName').value.trim();
            userData.title = document.getElementById('newTeacherTitle').value.trim();
            userData.department = document.getElementById('newTeacherDepartment').value.trim();
            userData.email = document.getElementById('newTeacherEmail').value.trim();
        }

        try {
            const response = await callAPI('/admin/users', {
                method: 'POST',
                body: userData
            });

            if (response.success) {
                showMessage('用户创建成功！', 'success');
                // 关闭模态框
                bootstrap.Modal.getInstance(document.getElementById('createUserModal')).hide();
                // 重新加载用户列表
                await this.loadUserData();
            } else {
                showMessage(response.error || '创建用户失败', 'danger');
            }
        } catch (error) {
            console.error('创建用户失败:', error);
            showMessage('创建用户失败，请重试', 'danger');
        }
    }

    /**
     * 切换用户状态
     */
    async toggleUserStatus(userId, newStatus) {
        const statusText = newStatus === 'active' ? '启用' : '禁用';
        if (!confirm(`确定要${statusText}此用户吗？`)) return;

        try {
            const response = await callAPI(`/admin/users/${userId}`, {
                method: 'PUT',
                body: { status: newStatus }
            });

            if (response.success) {
                showMessage(`用户已${statusText}`, 'success');
                await this.loadUserData();
            } else {
                showMessage(response.error || `操作失败`, 'danger');
            }
        } catch (error) {
            console.error(`切换用户状态失败:`, error);
            showMessage('操作失败，请重试', 'danger');
        }
    }

    /**
     * 显示重置密码模态框
     */
    showResetPasswordModal(userId, username) {
        const modalHTML = `
            <div class="modal fade" id="resetPasswordModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">重置密码</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p>确定要重置用户 <strong>${username}</strong> 的密码吗？</p>
                            <p>重置后密码将恢复为默认值：<code>123456</code></p>
                            <div class="alert alert-warning mt-3">
                                <i class="bi bi-exclamation-triangle"></i> 
                                建议通知用户首次登录后立即修改密码。
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                            <button type="button" class="btn btn-primary" onclick="adminDashboard.resetPassword('${userId}')">确定重置</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const modalContainer = document.getElementById('modalContainer') || document.createElement('div');
        modalContainer.id = 'modalContainer';
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer);

        const modal = new bootstrap.Modal(document.getElementById('resetPasswordModal'));
        modal.show();
    }

    /**
     * 重置密码
     */
    async resetPassword(userId) {
        try {
            const response = await callAPI(`/admin/users/${userId}/reset-password`, {
                method: 'POST',
                body: { new_password: '123456' }
            });

            if (response.success) {
                showMessage('密码重置成功！默认密码：123456', 'success');
                bootstrap.Modal.getInstance(document.getElementById('resetPasswordModal')).hide();
            } else {
                showMessage(response.error || '重置密码失败', 'danger');
            }
        } catch (error) {
            console.error('重置密码失败:', error);
            showMessage('重置密码失败，请重试', 'danger');
        }
    }

    /**
     * 显示删除用户模态框
     */
    showDeleteUserModal(userId, username) {
        const modalHTML = `
            <div class="modal fade" id="deleteUserModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title text-danger">删除用户</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-danger">
                                <i class="bi bi-exclamation-triangle"></i> 
                                <strong>警告：此操作不可撤销！</strong>
                            </div>
                            <p>确定要删除用户 <strong>${username}</strong> 吗？</p>
                            <p class="text-muted">删除后，该用户的所有相关信息将被永久删除。</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                            <button type="button" class="btn btn-danger" onclick="adminDashboard.deleteUser('${userId}')">删除用户</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const modalContainer = document.getElementById('modalContainer') || document.createElement('div');
        modalContainer.id = 'modalContainer';
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer);

        const modal = new bootstrap.Modal(document.getElementById('deleteUserModal'));
        modal.show();
    }

    /**
     * 删除用户
     */
    async deleteUser(userId) {
        try {
            const response = await callAPI(`/admin/users/${userId}`, {
                method: 'DELETE'
            });

            if (response.success) {
                showMessage('用户删除成功', 'success');
                bootstrap.Modal.getInstance(document.getElementById('deleteUserModal')).hide();
                await this.loadUserData();
            } else {
                showMessage(response.error || '删除用户失败', 'danger');
            }
        } catch (error) {
            console.error('删除用户失败:', error);
            showMessage('删除用户失败，请重试', 'danger');
        }
    }

    /**
     * 显示修改密码模态框
     */
    showChangePasswordModal() {
        const modalHTML = `
            <div class="modal fade" id="changePasswordModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">修改密码</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="changePasswordForm">
                                <div class="mb-3">
                                    <label class="form-label">旧密码 <span class="text-danger">*</span></label>
                                    <input type="password" class="form-control" id="oldPassword" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">新密码 <span class="text-danger">*</span></label>
                                    <input type="password" class="form-control" id="newPassword" required minlength="6">
                                    <div class="form-text">至少6个字符，建议包含字母、数字和特殊符号</div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">确认新密码 <span class="text-danger">*</span></label>
                                    <input type="password" class="form-control" id="confirmPassword" required>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                            <button type="button" class="btn btn-primary" onclick="adminDashboard.submitChangePassword()">提交修改</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        const modalContainer = document.getElementById('modalContainer') || document.createElement('div');
        modalContainer.id = 'modalContainer';
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer);
        new bootstrap.Modal(document.getElementById('changePasswordModal')).show();
    }

    /**
     * 提交修改密码请求
     */
    async submitChangePassword() {
        const oldPassword = document.getElementById('oldPassword').value.trim();
        const newPassword = document.getElementById('newPassword').value.trim();
        const confirmPassword = document.getElementById('confirmPassword').value.trim();
        
        // 前端二次校验
        if (!oldPassword || !newPassword || !confirmPassword) {
            showMessage('请填写所有必填字段', 'warning');
            return;
        }
        if (newPassword.length < 6) {
            showMessage('新密码至少6个字符', 'warning');
            return;
        }
        if (newPassword !== confirmPassword) {
            showMessage('新密码和确认密码不一致', 'warning');
            return;
        }
        if (oldPassword === newPassword) {
            showMessage('新密码不能与旧密码相同', 'warning');
            return;
        }
        
        // 提交状态处理
        const submitBtn = document.querySelector('#changePasswordModal .btn-primary');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<<i class="bi bi-hourglass-split"></</i> 提交中...';
        submitBtn.disabled = true;
        
        try {
            const response = await callAPI('/auth/change-password', {
                method: 'POST',
                body: { old_password: oldPassword, new_password: newPassword, confirm_password: confirmPassword }
            });
            if (response.success) {
                showMessage('密码修改成功，请重新登录', 'success');
                bootstrap.Modal.getInstance(document.getElementById('changePasswordModal')).hide();
                setTimeout(() => logout(), 2000);
            } else {
                showMessage(response.error || '修改失败', 'danger');
            }
        } catch (error) {
            console.error('修改密码失败:', error);
            showMessage('网络错误，请稍后重试', 'danger');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }



    // ==================== 学生管理页面 ====================

    /**
     * 加载学生管理页面
     */
    async loadStudents() {
        console.log('加载学生管理...');
        const mainContent = document.getElementById('mainContent');

        mainContent.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4>学生管理</h4>
                <div>
                    <button class="btn btn-outline-primary" onclick="adminDashboard.loadPage('students')">
                        <i class="bi bi-arrow-clockwise"></i> 刷新
                    </button>
                </div>
            </div>
            
            <!-- 筛选工具栏 -->
            <div class="card mb-4">
                <div class="card-body">
                    <div class="row g-3">
                        <div class="col-md-3">
                            <select class="form-select" id="studentFilterDept" onchange="adminDashboard.filterStudents()">
                                <option value="">所有院系</option>
                                <!-- 院系选项将由JavaScript动态生成 -->
                            </select>
                        </div>
                        <div class="col-md-3">
                            <select class="form-select" id="studentFilterStatus" onchange="adminDashboard.filterStudents()">
                                <option value="">所有状态</option>
                                <option value="active">在读</option>
                                <option value="leave">休学</option>
                                <option value="graduated">已毕业</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <input type="number" class="form-control" id="studentFilterYear" 
                                   placeholder="入学年份" onchange="adminDashboard.filterStudents()">
                        </div>
                        <div class="col-md-3">
                            <div class="input-group">
                                <input type="text" class="form-control" id="studentSearch" 
                                       placeholder="搜索学号、姓名、专业..." 
                                       onkeyup="adminDashboard.filterStudents()">
                                <button class="btn btn-outline-secondary" type="button" onclick="adminDashboard.filterStudents()">
                                    <i class="bi bi-search"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 批量操作工具栏 -->
            <div class="col-md-12 mb-4">
                <div class="d-flex justify-content-between align-items-center">
                    <!-- 添加学生按钮 + 批量操作 -->
                    <div class="d-flex gap-2 align-items-center">
                        <!-- 新增：添加学生按钮 -->
                        <button class="btn btn-primary" onclick="adminDashboard.showCreateStudentModal()">
                            <i class="bi bi-plus-circle"></i> 添加学生
                        </button>
                        <!-- 批量操作下拉 + 执行按钮 -->
                        <div class="btn-group">
                            <select class="form-select form-select-sm" id="batchAction" style="width: auto;">
                                <option value="">批量操作</option>
                                <option value="active">设为在读</option>
                                <option value="leave">设为休学</option>
                                <option value="graduated">设为已毕业</option>
                            </select>
                            <button class="btn btn-primary btn-sm" onclick="adminDashboard.executeBatchAction()">执行</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 学生表格 -->
            <div class="table-responsive" id="studentTableContainer">
                <div class="text-center py-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">加载中...</span>
                    </div>
                    <p class="mt-3">正在加载学生数据...</p>
                </div>
            </div>
            
        `;

        // 加载学生数据
        await this.loadStudentData();
    }

    /**
     * 加载学生数据
     */
    async loadStudentData() {
        try {
            const response = await callAPI('/admin/students');
            if (!response.success) {
                showMessage('获取学生列表失败: ' + (response.error || '未知错误'), 'danger');
                return;
            }

            this.students = this.extractData(response) || [];
            this.renderStudentTable();
            this.updateDepartmentFilter();
        } catch (error) {
            console.error('加载学生数据失败:', error);
            showMessage('加载学生数据失败，请重试', 'danger');
        }
    }

    /**
     * 更新院系筛选器
     */
    updateDepartmentFilter() {
        const departments = [...new Set(this.students.map(s => s.department).filter(d => d))];
        const deptSelect = document.getElementById('studentFilterDept');

        if (deptSelect) {
            // 清除现有选项（保留"所有院系"）
            while (deptSelect.options.length > 1) {
                deptSelect.remove(1);
            }

            // 添加院系选项
            departments.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept;
                option.textContent = dept;
                deptSelect.appendChild(option);
            });
        }
    }

    /**
     * 渲染学生表格
     */
    renderStudentTable(filteredStudents = null) {
        const studentsToRender = filteredStudents || this.students;
        const container = document.getElementById('studentTableContainer');

        if (!container) return;

        if (studentsToRender.length === 0) {
            container.innerHTML = `
                <div class="alert alert-warning">
                    <i class="bi bi-mortarboard"></i> 没有找到学生数据
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="table table-hover">
                <thead class="table-light">
                    <tr>
                        <th width="30">
                            <input type="checkbox" class="form-check-input" id="selectAllCheckbox" 
                                   onchange="adminDashboard.toggleSelectAllStudents()">
                        </th>
                        <th>学号</th>
                        <th>姓名</th>
                        <th>性别</th>
                        <th>院系</th>
                        <th>专业</th>
                        <th>入学年份</th>
                        <th>状态</th>
                        <th>账户状态</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${studentsToRender.map(student => `
                        <tr>
                            <td>
                                <input type="checkbox" class="form-check-input student-checkbox" 
                                       value="${student.student_id}" onchange="adminDashboard.updateSelectAllCheckbox()">
                            </td>
                            <td>${student.student_id}</td>
                            <td>${student.name || '-'}</td>
                            <td>${student.gender || '-'}</td>
                            <td>${student.department || '-'}</td>
                            <td>${student.major || '-'}</td>
                            <td>${student.enrollment_year || '-'}</td>
                            <td>
                                <span class="badge ${this.getStudentStatusBadgeClass(student.status)}">
                                    ${this.getStudentStatusText(student.status)}
                                </span>
                            </td>
                            <td>
                                <span class="badge ${student.account_status === 'active' ? 'bg-success' : 'bg-secondary'}">
                                    ${student.account_status === 'active' ? '活跃' : '禁用'}
                                </span>
                            </td>
                            <td>
                                <button class="btn btn-sm btn-outline-primary" onclick="adminDashboard.showStudentDetail('${student.student_id}')">
                                    详情
                                </button>
                                <button class="btn btn-sm btn-outline-info" onclick="adminDashboard.editStudent('${student.student_id}')">
                                    编辑
                                </button>
                                <button class="btn btn-sm btn-outline-danger ms-1" onclick="adminDashboard.showDeleteStudentModal('${student.student_id}', '${this.escapeString(student.name)}')">
                                    删除
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="alert alert-info mt-3">
                <i class="bi bi-info-circle"></i> 共 ${studentsToRender.length} 名学生
            </div>
        `;
    }

    /**
     * 筛选学生
     */
    filterStudents() {
        const dept = document.getElementById('studentFilterDept').value;
        const status = document.getElementById('studentFilterStatus').value;
        const year = document.getElementById('studentFilterYear').value;
        const keyword = document.getElementById('studentSearch').value.toLowerCase().trim();

        const filteredStudents = this.students.filter(student => {
            // 按院系筛选
            if (dept && student.department !== dept) return false;

            // 按状态筛选
            if (status && student.status !== status) return false;

            // 按入学年份筛选
            if (year && student.enrollment_year != year) return false;

            // 按关键词筛选
            if (keyword) {
                const searchFields = [
                    student.student_id,
                    student.name,
                    student.department,
                    student.major
                ].filter(field => field);

                return searchFields.some(field =>
                    field.toLowerCase().includes(keyword)
                );
            }

            return true;
        });

        this.renderStudentTable(filteredStudents);
    }

    /**
     * 全选/取消全选学生
     */
    toggleSelectAllStudents() {
        const selectAll = document.getElementById('selectAllCheckbox') ||
            document.getElementById('selectAllStudents');
        const checkboxes = document.querySelectorAll('.student-checkbox');

        if (selectAll) {
            const isChecked = selectAll.checked;
            checkboxes.forEach(checkbox => {
                checkbox.checked = isChecked;
            });
        }
    }

    /**
     * 更新全选复选框状态
     */
    updateSelectAllCheckbox() {
        const checkboxes = document.querySelectorAll('.student-checkbox');
        const selectAll = document.getElementById('selectAllCheckbox') ||
            document.getElementById('selectAllStudents');

        if (selectAll && checkboxes.length > 0) {
            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
            const someChecked = Array.from(checkboxes).some(cb => cb.checked);

            selectAll.checked = allChecked;
            selectAll.indeterminate = someChecked && !allChecked;
        }
    }

    /**
     * 获取选中的学生ID
     */
    getSelectedStudentIds() {
        const checkboxes = document.querySelectorAll('.student-checkbox:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    /**
     * 执行批量操作
     */
    async executeBatchAction() {
        const action = document.getElementById('batchAction').value;
        const studentIds = this.getSelectedStudentIds();

        if (!action) {
            showMessage('请选择要执行的操作', 'warning');
            return;
        }

        if (studentIds.length === 0) {
            showMessage('请至少选择一名学生', 'warning');
            return;
        }

        const actionText = {
            'active': '设为在读',
            'leave': '设为休学',
            'graduated': '设为已毕业'
        }[action];

        if (!confirm(`确定要将选中的 ${studentIds.length} 名学生${actionText}吗？`)) {
            return;
        }

        try {
            const response = await callAPI('/admin/students/batch-update', {
                method: 'POST',
                body: {
                    student_ids: studentIds,
                    status: action
                }
            });

            if (response.success) {
                showMessage(`成功更新 ${response.data?.updated_count || 0} 名学生状态`, 'success');
                await this.loadStudentData();
            } else {
                showMessage(response.error || '批量操作失败', 'danger');
            }
        } catch (error) {
            console.error('批量操作失败:', error);
            showMessage('批量操作失败，请重试', 'danger');
        }
    }

    /**
     * 显示添加学生模态框
    */
    showCreateStudentModal() {
    const modalHTML = `
        <div class="modal fade" id="createStudentModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">添加新学生</h5>
                        <button class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="createStudentForm">
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">学号 <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="newStudentId" required placeholder="如：20230001">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">用户名 <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="newStudentUsername" required placeholder="至少3个字符">
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">密码 <span class="text-danger">*</span></label>
                                    <input type="password" class="form-control" id="newStudentPassword" required placeholder="至少6个字符" value="123456">
                                    <div class="form-text">默认密码：123456，建议学生首次登录后修改</div>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">姓名 <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="newStudentName" required placeholder="学生姓名">
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">院系 <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="newStudentDepartment" required placeholder="如：计算机与电子信息学院">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">专业 <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="newStudentMajor" required placeholder="如：信息安全">
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">身份证号</label>
                                    <input type="text" class="form-control" id="newStudentIdCard" placeholder="18位身份证号">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">手机号</label>
                                    <input type="text" class="form-control" id="newStudentPhone" placeholder="11位手机号">
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                        <button class="btn btn-primary" onclick="adminDashboard.createStudent()">创建</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    const modalContainer = document.getElementById('modalContainer') || document.createElement('div');
    modalContainer.id = 'modalContainer';
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);
    new bootstrap.Modal(document.getElementById('createStudentModal')).show();
    }

    /**
    * 创建新学生（调用后端API）
    */
    async createStudent() {
    const studentId = document.getElementById('newStudentId').value.trim();
    const username = document.getElementById('newStudentUsername').value.trim();
    const password = document.getElementById('newStudentPassword').value;
    const name = document.getElementById('newStudentName').value.trim();
    const department = document.getElementById('newStudentDepartment').value.trim();
    const major = document.getElementById('newStudentMajor').value.trim();
    const idCard = document.getElementById('newStudentIdCard').value.trim();
    const phone = document.getElementById('newStudentPhone').value.trim();
    
    // 基础验证
    if (!studentId || !username || !password || !name || !department || !major) {
        showMessage('请填写所有必填字段', 'warning');
        return;
    }
    
    // 调用后端API
    try {
        const response = await callAPI('/admin/students', {
            method: 'POST',
            body: {
                student_id: studentId,
                username: username,
                password: password,
                name: name,
                department: department,
                major: major,
                id_card: idCard,
                phone: phone,
                enrollment_year: new Date().getFullYear()
            }
        });
        if (response.success) {
            showMessage('学生创建成功！', 'success');
            bootstrap.Modal.getInstance(document.getElementById('createStudentModal')).hide();
            await this.loadStudentData();
        } else {
            showMessage(response.error || '创建失败', 'danger');
        }
    } catch (error) {
        showMessage('网络错误，请重试', 'danger');
    }
    }
    /**
    * 显示删除学生模态框
     */
    showDeleteStudentModal(studentId, studentName) {
    const modalHTML = `
        <div class="modal fade" id="deleteStudentModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title text-danger">删除学生</h5>
                        <button class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-danger">警告：此操作不可撤销！</div>
                        <p>确定删除学生 <strong>${studentName}</strong>（学号：${studentId}）？</p>
                        <p class="text-muted">有选课记录的学生无法删除</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                        <button class="btn btn-danger" onclick="adminDashboard.deleteStudent('${studentId}')">删除</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    const modalContainer = document.getElementById('modalContainer') || document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);
    new bootstrap.Modal(document.getElementById('deleteStudentModal')).show();
    }

    /**
    * 删除学生（调用后端API）
    */
    async deleteStudent(studentId) {
    try {
        const response = await callAPI(`/admin/students/${studentId}`, { method: 'DELETE' });
        if (response.success) {
            showMessage('学生删除成功', 'success');
            bootstrap.Modal.getInstance(document.getElementById('deleteStudentModal')).hide();
            await this.loadStudentData();
        } else {
            showMessage(response.error || '删除失败', 'danger');
        }
    } catch (error) {
        showMessage('网络错误，请重试', 'danger');
    }
    }

    /**
     * 显示学生详情
     */
    async showStudentDetail(studentId) {
        try {
            // 从现有数据中查找学生
            const student = this.students.find(s => s.student_id === studentId);
            if (!student) {
                showMessage('未找到学生信息', 'warning');
                return;
            }

            const modalHTML = `
                <div class="modal fade" id="studentDetailModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">学生详情 - ${student.name} (${student.student_id})</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row">
                                    <div class="col-md-6">
                                        <table class="table table-sm">
                                            <tr>
                                                <th width="40%">学号：</th>
                                                <td>${student.student_id}</td>
                                            </tr>
                                            <tr>
                                                <th>姓名：</th>
                                                <td>${student.name || '-'}</td>
                                            </tr>
                                            <tr>
                                                <th>性别：</th>
                                                <td>${student.gender || '-'}</td>
                                            </tr>
                                            <tr>
                                                <th>出生日期：</th>
                                                <td>${student.birth_date || '-'}</td>
                                            </tr>
                                            <tr>
                                                <th>身份证号：</th>
                                                <td>${student.id_card ? '***' + student.id_card.slice(-4) : '未设置'}</td>
                                            </tr>
                                        </table>
                                    </div>
                                    <div class="col-md-6">
                                        <table class="table table-sm">
                                            <tr>
                                                <th width="40%">手机号：</th>
                                                <td>${student.phone ? '***' + student.phone.slice(-4) : '未设置'}</td>
                                            </tr>
                                            <tr>
                                                <th>邮箱：</th>
                                                <td>${student.email || '-'}</td>
                                            </tr>
                                            <tr>
                                                <th>院系：</th>
                                                <td>${student.department || '-'}</td>
                                            </tr>
                                            <tr>
                                                <th>专业：</th>
                                                <td>${student.major || '-'}</td>
                                            </tr>
                                            <tr>
                                                <th>入学年份：</th>
                                                <td>${student.enrollment_year || '-'}</td>
                                            </tr>
                                        </table>
                                    </div>
                                </div>
                                
                                <div class="row mt-3">
                                    <div class="col-md-12">
                                        <table class="table table-sm">
                                            <tr>
                                                <th width="20%">学生状态：</th>
                                                <td>
                                                    <span class="badge ${this.getStudentStatusBadgeClass(student.status)}">
                                                        ${this.getStudentStatusText(student.status)}
                                                    </span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <th>账户状态：</th>
                                                <td>
                                                    <span class="badge ${student.account_status === 'active' ? 'bg-success' : 'bg-secondary'}">
                                                        ${student.account_status === 'active' ? '活跃' : '禁用'}
                                                    </span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <th>用户名：</th>
                                                <td>${student.username || '-'}</td>
                                            </tr>
                                            <tr>
                                                <th>最后登录：</th>
                                                <td>${student.last_login ? formatDate(student.last_login) : '从未登录'}</td>
                                            </tr>
                                            <tr>
                                                <th>创建时间：</th>
                                                <td>${student.created_at ? formatDate(student.created_at) : '-'}</td>
                                            </tr>
                                            <tr>
                                                <th>更新时间：</th>
                                                <td>${student.updated_at ? formatDate(student.updated_at) : '-'}</td>
                                            </tr>
                                        </table>
                                    </div>
                                </div>
                                
                                <div class="alert alert-info mt-3">
                                    <i class="bi bi-shield-check"></i> 
                                    敏感信息（身份证号、手机号）已加密存储。显示内容为部分脱敏信息。
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
                                <button type="button" class="btn btn-primary" onclick="adminDashboard.editStudent('${studentId}')">编辑信息</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            const modalContainer = document.getElementById('modalContainer') || document.createElement('div');
            modalContainer.id = 'modalContainer';
            modalContainer.innerHTML = modalHTML;
            document.body.appendChild(modalContainer);

            const modal = new bootstrap.Modal(document.getElementById('studentDetailModal'));
            modal.show();

        } catch (error) {
            console.error('显示学生详情失败:', error);
            showMessage('显示学生详情失败', 'danger');
        }
    }

    /**
     * 编辑学生信息
     */
    async editStudent(studentId) {
        try {
            // 从现有数据中查找学生
            const student = this.students.find(s => s.student_id === studentId);
            if (!student) {
                showMessage('未找到学生信息', 'warning');
                return;
            }

            const modalHTML = `
                <div class="modal fade" id="editStudentModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">编辑学生信息 - ${student.name} (${student.student_id})</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <form id="editStudentForm">
                                    <div class="row">
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">学号</label>
                                            <input type="text" class="form-control" value="${student.student_id}" disabled>
                                        </div>
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">姓名</label>
                                            <input type="text" class="form-control" id="editStudentName" 
                                                   value="${student.name || ''}">
                                        </div>
                                    </div>
                                    
                                    <div class="row">
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">性别</label>
                                            <select class="form-select" id="editStudentGender">
                                                <option value="">请选择</option>
                                                <option value="男" ${student.gender === '男' ? 'selected' : ''}>男</option>
                                                <option value="女" ${student.gender === '女' ? 'selected' : ''}>女</option>
                                            </select>
                                        </div>
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">出生日期</label>
                                            <input type="date" class="form-control" id="editStudentBirthDate" 
                                                   value="${student.birth_date || ''}">
                                        </div>
                                    </div>
                                    
                                    <div class="row">
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">身份证号</label>
                                            <input type="text" class="form-control" id="editStudentIdCard" 
                                                   value="${student.id_card || ''}" maxlength="18">
                                            <div class="form-text">18位身份证号，如需修改请填写完整号码</div>
                                        </div>
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">手机号</label>
                                            <input type="text" class="form-control" id="editStudentPhone" 
                                                   value="${student.phone || ''}">
                                        </div>
                                    </div>
                                    
                                    <div class="row">
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">邮箱</label>
                                            <input type="email" class="form-control" id="editStudentEmail" 
                                                   value="${student.email || ''}">
                                        </div>
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">入学年份</label>
                                            <input type="number" class="form-control" id="editStudentEnrollmentYear" 
                                                   value="${student.enrollment_year || new Date().getFullYear()}" 
                                                   min="2000" max="${new Date().getFullYear() + 10}">
                                        </div>
                                    </div>
                                    
                                    <div class="row">
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">院系</label>
                                            <input type="text" class="form-control" id="editStudentDepartment" 
                                                   value="${student.department || ''}">
                                        </div>
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">专业</label>
                                            <input type="text" class="form-control" id="editStudentMajor" 
                                                   value="${student.major || ''}">
                                        </div>
                                    </div>
                                    
                                    <div class="row">
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">学生状态</label>
                                            <select class="form-select" id="editStudentStatus">
                                                <option value="active" ${student.status === 'active' ? 'selected' : ''}>在读</option>
                                                <option value="leave" ${student.status === 'leave' ? 'selected' : ''}>休学</option>
                                                <option value="graduated" ${student.status === 'graduated' ? 'selected' : ''}>已毕业</option>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div class="alert alert-info mt-3">
                                        <i class="bi bi-info-circle"></i> 
                                        身份证号和手机号将自动加密存储。邮箱和出生日期将直接存储。
                                    </div>
                                </form>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                                <button type="button" class="btn btn-primary" onclick="adminDashboard.updateStudent('${studentId}')">保存更改</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            const modalContainer = document.getElementById('modalContainer') || document.createElement('div');
            modalContainer.id = 'modalContainer';
            modalContainer.innerHTML = modalHTML;
            document.body.appendChild(modalContainer);

            const modal = new bootstrap.Modal(document.getElementById('editStudentModal'));
            modal.show();

        } catch (error) {
            console.error('编辑学生信息失败:', error);
            showMessage('编辑学生信息失败', 'danger');
        }
    }

    /**
     * 更新学生信息
     */
    async updateStudent(studentId) {
        const name = document.getElementById('editStudentName').value.trim();
        const gender = document.getElementById('editStudentGender').value;
        const birthDate = document.getElementById('editStudentBirthDate').value;
        const idCard = document.getElementById('editStudentIdCard').value.trim();
        const phone = document.getElementById('editStudentPhone').value.trim();
        const email = document.getElementById('editStudentEmail').value.trim();
        const enrollmentYear = document.getElementById('editStudentEnrollmentYear').value;
        const department = document.getElementById('editStudentDepartment').value.trim();
        const major = document.getElementById('editStudentMajor').value.trim();
        const status = document.getElementById('editStudentStatus').value;

        // 验证邮箱格式
        if (email && !isValidEmail(email)) {
            showMessage('邮箱格式不正确', 'warning');
            return;
        }

        // 验证身份证号格式（如果提供）
        if (idCard && idCard.length !== 18) {
            showMessage('身份证号必须是18位', 'warning');
            return;
        }

        // 验证手机号格式（如果提供）
        if (phone && !isValidPhone(phone)) {
            showMessage('手机号格式不正确', 'warning');
            return;
        }

        const studentData = {
            name: name || null,
            gender: gender || null,
            birth_date: birthDate || null,
            id_card: idCard || null,
            phone: phone || null,
            email: email || null,
            enrollment_year: enrollmentYear || null,
            department: department || null,
            major: major || null,
            status: status
        };

        try {
            const response = await callAPI(`/admin/students/${studentId}`, {
                method: 'PUT',
                body: studentData
            });

            if (response.success) {
                showMessage('学生信息更新成功！', 'success');
                bootstrap.Modal.getInstance(document.getElementById('editStudentModal')).hide();
                await this.loadStudentData();
            } else {
                showMessage(response.error || '更新学生信息失败', 'danger');
            }
        } catch (error) {
            console.error('更新学生信息失败:', error);
            showMessage('更新学生信息失败，请重试', 'danger');
        }
    }

    // ==================== 教师管理页面 ====================

    /**
     * 加载教师管理页面
     */
    async loadTeachers() {
        console.log('加载教师管理...');
        const mainContent = document.getElementById('mainContent');

        mainContent.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4>教师管理</h4>
                <div>
                    <button class="btn btn-primary me-2" onclick="adminDashboard.showCreateTeacherModal()">
                    <i class="bi bi-plus-circle"></i> 添加教师
                    </button>
                    <button class="btn btn-outline-primary" onclick="adminDashboard.loadPage('teachers')">刷新</button>
                </div>
            </div>
            
            <!-- 筛选工具栏 -->
            <div class="card mb-4">
                <div class="card-body">
                    <div class="row g-3">
                        <div class="col-md-4">
                            <select class="form-select" id="teacherFilterDept" onchange="adminDashboard.filterTeachers()">
                                <option value="">所有院系</option>
                                <!-- 院系选项将由JavaScript动态生成 -->
                            </select>
                        </div>
                        <div class="col-md-8">
                            <div class="input-group">
                                <input type="text" class="form-control" id="teacherSearch" 
                                       placeholder="搜索工号、姓名、职称..." 
                                       onkeyup="adminDashboard.filterTeachers()">
                                <button class="btn btn-outline-secondary" type="button" onclick="adminDashboard.filterTeachers()">
                                    <i class="bi bi-search"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 教师表格 -->
            <div class="table-responsive" id="teacherTableContainer">
                <div class="text-center py-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">加载中...</span>
                    </div>
                    <p class="mt-3">正在加载教师数据...</p>
                </div>
            </div>
        `;

        // 加载教师数据
        await this.loadTeacherData();
    }

    /**
     * 加载教师数据
     */
    async loadTeacherData() {
        try {
            const response = await callAPI('/admin/teachers');
            if (!response.success) {
                showMessage('获取教师列表失败: ' + (response.error || '未知错误'), 'danger');
                return;
            }

            this.teachers = this.extractData(response) || [];
            this.renderTeacherTable();
            this.updateTeacherDepartmentFilter();
        } catch (error) {
            console.error('加载教师数据失败:', error);
            showMessage('加载教师数据失败，请重试', 'danger');
        }
    }

    /**
     * 更新教师院系筛选器
     */
    updateTeacherDepartmentFilter() {
        const departments = [...new Set(this.teachers.map(t => t.department).filter(d => d))];
        const deptSelect = document.getElementById('teacherFilterDept');

        if (deptSelect) {
            // 清除现有选项（保留"所有院系"）
            while (deptSelect.options.length > 1) {
                deptSelect.remove(1);
            }

            // 添加院系选项
            departments.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept;
                option.textContent = dept;
                deptSelect.appendChild(option);
            });
        }
    }

    /**
     * 渲染教师表格
     */
    renderTeacherTable(filteredTeachers = null) {
        const teachersToRender = filteredTeachers || this.teachers;
        const container = document.getElementById('teacherTableContainer');

        if (!container) return;

        if (teachersToRender.length === 0) {
            container.innerHTML = `
                <div class="alert alert-warning">
                    <i class="bi bi-person-badge"></i> 没有找到教师数据
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="table table-hover">
                <thead class="table-light">
                    <tr>
                        <th>工号</th>
                        <th>姓名</th>
                        <th>性别</th>
                        <th>职称</th>
                        <th>院系</th>
                        <th>办公室</th>
                        <th>教学任务数</th>
                        <th>账户状态</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${teachersToRender.map(teacher => `
                        <tr>
                            <td>${teacher.teacher_id}</td>
                            <td>${teacher.name || '-'}</td>
                            <td>${teacher.gender || '-'}</td>
                            <td>${teacher.title || '-'}</td>
                            <td>${teacher.department || '-'}</td>
                            <td>${teacher.office || '-'}</td>
                            <td>
                                <span class="badge bg-info">${teacher.teaching_count || 0}</span>
                            </td>
                            <td>
                                <span class="badge ${teacher.account_status === 'active' ? 'bg-success' : 'bg-secondary'}">
                                    ${teacher.account_status === 'active' ? '活跃' : '禁用'}
                                </span>
                            </td>
                            <td>
                                <button class="btn btn-sm btn-outline-primary" onclick="adminDashboard.showTeacherDetail('${teacher.teacher_id}')">
                                    详情
                                </button>
                                <button class="btn btn-sm btn-outline-info" onclick="adminDashboard.editTeacher('${teacher.teacher_id}')">
                                    编辑
                                </button>
                                <button class="btn btn-sm btn-outline-danger ms-1" onclick="adminDashboard.showDeleteTeacherModal('${teacher.teacher_id}', '${this.escapeString(teacher.name)}')">
                                    删除
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="alert alert-info mt-3">
                <i class="bi bi-info-circle"></i> 共 ${teachersToRender.length} 名教师
            </div>
        `;
    }

    /**
     * 筛选教师
     */
    filterTeachers() {
        const dept = document.getElementById('teacherFilterDept').value;
        const keyword = document.getElementById('teacherSearch').value.toLowerCase().trim();

        const filteredTeachers = this.teachers.filter(teacher => {
            // 按院系筛选
            if (dept && teacher.department !== dept) return false;

            // 按关键词筛选
            if (keyword) {
                const searchFields = [
                    teacher.teacher_id,
                    teacher.name,
                    teacher.title,
                    teacher.department,
                    teacher.office
                ].filter(field => field);

                return searchFields.some(field =>
                    field.toLowerCase().includes(keyword)
                );
            }

            return true;
        });

        this.renderTeacherTable(filteredTeachers);
    }

    /**
     * 显示教师详情
     */
    async showTeacherDetail(teacherId) {
        try {
            // 从现有数据中查找教师
            const teacher = this.teachers.find(t => t.teacher_id === teacherId);
            if (!teacher) {
                showMessage('未找到教师信息', 'warning');
                return;
            }

            const modalHTML = `
                <div class="modal fade" id="teacherDetailModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">教师详情 - ${teacher.name} (${teacher.teacher_id})</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row">
                                    <div class="col-md-6">
                                        <table class="table table-sm">
                                            <tr>
                                                <th width="40%">工号：</th>
                                                <td>${teacher.teacher_id}</td>
                                            </tr>
                                            <tr>
                                                <th>姓名：</th>
                                                <td>${teacher.name || '-'}</td>
                                            </tr>
                                            <tr>
                                                <th>性别：</th>
                                                <td>${teacher.gender || '-'}</td>
                                            </tr>
                                            <tr>
                                                <th>职称：</th>
                                                <td>${teacher.title || '-'}</td>
                                            </tr>
                                            <tr>
                                                <th>院系：</th>
                                                <td>${teacher.department || '-'}</td>
                                            </tr>
                                        </table>
                                    </div>
                                    <div class="col-md-6">
                                        <table class="table table-sm">
                                            <tr>
                                                <th width="40%">办公室：</th>
                                                <td>${teacher.office || '-'}</td>
                                            </tr>
                                            <tr>
                                                <th>联系电话：</th>
                                                <td>${teacher.phone || '-'}</td>
                                            </tr>
                                            <tr>
                                                <th>邮箱：</th>
                                                <td>${teacher.email || '-'}</td>
                                            </tr>
                                            <tr>
                                                <th>教学任务数：</th>
                                                <td>${teacher.teaching_count || 0}</td>
                                            </tr>
                                        </table>
                                    </div>
                                </div>
                                
                                <div class="row mt-3">
                                    <div class="col-md-12">
                                        <table class="table table-sm">
                                            <tr>
                                                <th width="20%">账户状态：</th>
                                                <td>
                                                    <span class="badge ${teacher.account_status === 'active' ? 'bg-success' : 'bg-secondary'}">
                                                        ${teacher.account_status === 'active' ? '活跃' : '禁用'}
                                                    </span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <th>用户名：</th>
                                                <td>${teacher.username || '-'}</td>
                                            </tr>
                                            <tr>
                                                <th>最后登录：</th>
                                                <td>${teacher.last_login ? formatDate(teacher.last_login) : '从未登录'}</td>
                                            </tr>
                                            <tr>
                                                <th>创建时间：</th>
                                                <td>${teacher.created_at ? formatDate(teacher.created_at) : '-'}</td>
                                            </tr>
                                            <tr>
                                                <th>更新时间：</th>
                                                <td>${teacher.updated_at ? formatDate(teacher.updated_at) : '-'}</td>
                                            </tr>
                                        </table>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
                                <button type="button" class="btn btn-primary" onclick="adminDashboard.editTeacher('${teacherId}')">编辑信息</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            const modalContainer = document.getElementById('modalContainer') || document.createElement('div');
            modalContainer.id = 'modalContainer';
            modalContainer.innerHTML = modalHTML;
            document.body.appendChild(modalContainer);

            const modal = new bootstrap.Modal(document.getElementById('teacherDetailModal'));
            modal.show();

        } catch (error) {
            console.error('显示教师详情失败:', error);
            showMessage('显示教师详情失败', 'danger');
        }
    }

    /**
     * 编辑教师信息
     */
    async editTeacher(teacherId) {
        try {
            // 从现有数据中查找教师
            const teacher = this.teachers.find(t => t.teacher_id === teacherId);
            if (!teacher) {
                showMessage('未找到教师信息', 'warning');
                return;
            }

            const modalHTML = `
                <div class="modal fade" id="editTeacherModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">编辑教师信息 - ${teacher.name} (${teacher.teacher_id})</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <form id="editTeacherForm">
                                    <div class="row">
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">工号</label>
                                            <input type="text" class="form-control" value="${teacher.teacher_id}" disabled>
                                        </div>
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">姓名</label>
                                            <input type="text" class="form-control" id="editTeacherName" 
                                                   value="${teacher.name || ''}">
                                        </div>
                                    </div>
                                    
                                    <div class="row">
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">性别</label>
                                            <select class="form-select" id="editTeacherGender">
                                                <option value="">请选择</option>
                                                <option value="男" ${teacher.gender === '男' ? 'selected' : ''}>男</option>
                                                <option value="女" ${teacher.gender === '女' ? 'selected' : ''}>女</option>
                                            </select>
                                        </div>
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">职称</label>
                                            <input type="text" class="form-control" id="editTeacherTitle" 
                                                   value="${teacher.title || ''}">
                                        </div>
                                    </div>
                                    
                                    <div class="row">
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">院系</label>
                                            <input type="text" class="form-control" id="editTeacherDepartment" 
                                                   value="${teacher.department || ''}">
                                        </div>
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">办公室</label>
                                            <input type="text" class="form-control" id="editTeacherOffice" 
                                                   value="${teacher.office || ''}">
                                        </div>
                                    </div>
                                    
                                    <div class="row">
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">联系电话</label>
                                            <input type="text" class="form-control" id="editTeacherPhone" 
                                                   value="${teacher.phone || ''}">
                                            <div class="form-text">11位手机号</div>
                                        </div>
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">邮箱</label>
                                            <input type="email" class="form-control" id="editTeacherEmail" 
                                                   value="${teacher.email || ''}">
                                        </div>
                                    </div>
                                </form>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                                <button type="button" class="btn btn-primary" onclick="adminDashboard.updateTeacher('${teacherId}')">保存更改</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            const modalContainer = document.getElementById('modalContainer') || document.createElement('div');
            modalContainer.id = 'modalContainer';
            modalContainer.innerHTML = modalHTML;
            document.body.appendChild(modalContainer);

            const modal = new bootstrap.Modal(document.getElementById('editTeacherModal'));
            modal.show();

        } catch (error) {
            console.error('编辑教师信息失败:', error);
            showMessage('编辑教师信息失败', 'danger');
        }
    }

    /**
     * 更新教师信息
     */
    async updateTeacher(teacherId) {
        const name = document.getElementById('editTeacherName').value.trim();
        const gender = document.getElementById('editTeacherGender').value;
        const title = document.getElementById('editTeacherTitle').value.trim();
        const department = document.getElementById('editTeacherDepartment').value.trim();
        const office = document.getElementById('editTeacherOffice').value.trim();
        const phone = document.getElementById('editTeacherPhone').value.trim();
        const email = document.getElementById('editTeacherEmail').value.trim();

        // 验证邮箱格式
        if (email && !isValidEmail(email)) {
            showMessage('邮箱格式不正确', 'warning');
            return;
        }

        // 验证手机号格式（如果提供）
        if (phone && !isValidPhone(phone)) {
            showMessage('手机号格式不正确', 'warning');
            return;
        }

        const teacherData = {
            name: name || null,
            gender: gender || null,
            title: title || null,
            department: department || null,
            office: office || null,
            phone: phone || null,
            email: email || null
        };

        try {
            const response = await callAPI(`/admin/teachers/${teacherId}`, {
                method: 'PUT',
                body: teacherData
            });

            if (response.success) {
                showMessage('教师信息更新成功！', 'success');
                bootstrap.Modal.getInstance(document.getElementById('editTeacherModal')).hide();
                await this.loadTeacherData();
            } else {
                showMessage(response.error || '更新教师信息失败', 'danger');
            }
        } catch (error) {
            console.error('更新教师信息失败:', error);
            showMessage('更新教师信息失败，请重试', 'danger');
        }
    }
    /**
    * 显示添加教师模态框
    */
    showCreateTeacherModal() {
    const modalHTML = `
        <div class="modal fade" id="createTeacherModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">添加新教师</h5>
                        <button class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="createTeacherForm">
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">工号 <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="newTeacherId" required placeholder="如：T2023001">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">用户名 <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="newTeacherUsername" required placeholder="至少3个字符">
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">密码 <span class="text-danger">*</span></label>
                                    <input type="password" class="form-control" id="newTeacherPassword" required placeholder="至少6个字符" value="123456">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">姓名 <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="newTeacherName" required placeholder="教师姓名">
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">院系 <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="newTeacherDepartment" required placeholder="如：计算机与电子信息学院">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">职称 <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="newTeacherTitle" required placeholder="如：副教授">
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                        <button class="btn btn-primary" onclick="adminDashboard.createTeacher()">创建</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    const modalContainer = document.getElementById('modalContainer') || document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);
    new bootstrap.Modal(document.getElementById('createTeacherModal')).show();
    }

    /**
    * 创建新教师（调用后端API）
    */
    async createTeacher() {
    const teacherId = document.getElementById('newTeacherId').value.trim();
    const username = document.getElementById('newTeacherUsername').value.trim();
    const password = document.getElementById('newTeacherPassword').value;
    const name = document.getElementById('newTeacherName').value.trim();
    const department = document.getElementById('newTeacherDepartment').value.trim();
    const title = document.getElementById('newTeacherTitle').value.trim();
    
    if (!teacherId || !username || !password || !name || !department || !title) {
        showMessage('请填写所有必填字段', 'warning');
        return;
    }
    
    try {
        const response = await callAPI('/admin/teachers', {
            method: 'POST',
            body: {
                teacher_id: teacherId,
                username: username,
                password: password,
                name: name,
                department: department,
                title: title
            }
        });
        if (response.success) {
            showMessage('教师创建成功！', 'success');
            bootstrap.Modal.getInstance(document.getElementById('createTeacherModal')).hide();
            await this.loadTeacherData();
        } else {
            showMessage(response.error || '创建失败', 'danger');
        }
    } catch (error) {
        showMessage('网络错误，请重试', 'danger');
    }
    }
    /**
    * 显示删除教师模态框
    */
    showDeleteTeacherModal(teacherId, teacherName) {
    const modalHTML = `
        <div class="modal fade" id="deleteTeacherModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title text-danger">删除教师</h5>
                        <button class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-danger">警告：此操作不可撤销！</div>
                        <p>确定删除教师 <strong>${teacherName}</strong>（工号：${teacherId}）？</p>
                        <p class="text-muted">有教学任务的教师无法删除</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                        <button class="btn btn-danger" onclick="adminDashboard.deleteTeacher('${teacherId}')">删除</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    const modalContainer = document.getElementById('modalContainer') || document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);
    new bootstrap.Modal(document.getElementById('deleteTeacherModal')).show();
    }

    /**
    * 删除教师（调用后端API）
    */
    async deleteTeacher(teacherId) {
    try {
        const response = await callAPI(`/admin/teachers/${teacherId}`, { method: 'DELETE' });
        if (response.success) {
            showMessage('教师删除成功', 'success');
            bootstrap.Modal.getInstance(document.getElementById('deleteTeacherModal')).hide();
            await this.loadTeacherData();
        } else {
            showMessage(response.error || '删除失败', 'danger');
        }
    } catch (error) {
        showMessage('网络错误，请重试', 'danger');
    }
    }


    // ==================== 课程管理页面 ====================

    /**
     * 加载课程管理页面
     */
    async loadCourses() {
        console.log('加载课程管理...');
        const mainContent = document.getElementById('mainContent');

        mainContent.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4>课程管理</h4>
                <div>
                    <button class="btn btn-primary" onclick="adminDashboard.showCreateCourseModal()">
                        <i class="bi bi-plus-circle"></i> 创建课程
                    </button>
                    <button class="btn btn-outline-primary ms-2" onclick="adminDashboard.loadPage('courses')">
                        <i class="bi bi-arrow-clockwise"></i> 刷新
                    </button>
                </div>
            </div>
            
            <!-- 筛选工具栏 -->
            <div class="card mb-4">
                <div class="card-body">
                    <div class="row g-3">
                        <div class="col-md-3">
                            <select class="form-select" id="courseFilterType" onchange="adminDashboard.filterCourses()">
                                <option value="">所有类型</option>
                                <option value="compulsory">必修</option>
                                <option value="elective">选修</option>
                                <option value="general">通识</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <select class="form-select" id="courseFilterSemester" onchange="adminDashboard.filterCourses()">
                                <option value="">所有学期</option>
                                <!-- 学期选项将由JavaScript动态生成 -->
                            </select>
                        </div>
                        <div class="col-md-6">
                            <div class="input-group">
                                <input type="text" class="form-control" id="courseSearch" 
                                       placeholder="搜索课程号、课程名称..." 
                                       onkeyup="adminDashboard.filterCourses()">
                                <button class="btn btn-outline-secondary" type="button" onclick="adminDashboard.filterCourses()">
                                    <i class="bi bi-search"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 课程表格 -->
            <div class="table-responsive" id="courseTableContainer">
                <div class="text-center py-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">加载中...</span>
                    </div>
                    <p class="mt-3">正在加载课程数据...</p>
                </div>
            </div>
        `;

        // 加载课程数据
        await this.loadCourseData();
        // 加载教师数据
        await this.loadTeacherData();
    }

    /**
     * 加载课程数据
     */
    async loadCourseData() {
        try {
            const response = await callAPI('/course');
            if (!response.success) {
                showMessage('获取课程列表失败: ' + (response.error || '未知错误'), 'danger');
                return;
            }

            this.courses = this.extractData(response) || [];
            this.renderCourseTable();
            this.updateSemesterFilter();
        } catch (error) {
            console.error('加载课程数据失败:', error);
            showMessage('加载课程数据失败，请重试', 'danger');
        }
    }

    /**
     * 更新学期筛选器
     */
    updateSemesterFilter() {
        const semesters = [...new Set(this.courses.map(c => c.semester).filter(s => s))].sort().reverse();
        const semesterSelect = document.getElementById('courseFilterSemester');

        if (semesterSelect) {
            // 清除现有选项（保留"所有学期"）
            while (semesterSelect.options.length > 1) {
                semesterSelect.remove(1);
            }

            // 添加学期选项
            semesters.forEach(semester => {
                const option = document.createElement('option');
                option.value = semester;
                option.textContent = semester;
                semesterSelect.appendChild(option);
            });
        }
    }

    /**
     * 渲染课程表格
     */
    renderCourseTable(filteredCourses = null) {
        const coursesToRender = filteredCourses || this.courses;
        const container = document.getElementById('courseTableContainer');

        if (!container) return;

        if (coursesToRender.length === 0) {
            container.innerHTML = `
                <div class="alert alert-warning">
                    <i class="bi bi-book"></i> 没有找到课程数据
                    <p class="mb-0 mt-2">点击"创建课程"按钮添加新课程。</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="table table-hover">
                <thead class="table-light">
                    <tr>
                        <th>课程号</th>
                        <th>课程名称</th>
                        <th>学分</th>
                        <th>类型</th>
                        <th>学期</th>
                        <th>教师</th>
                        <th>选课人数</th>
                        <th>容量</th>
                        <th>创建时间</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${coursesToRender.map(course => `
                        <tr>
                            <td>${course.course_id}</td>
                            <td>
                                <strong>${course.course_name}</strong>
                                ${course.description ? `<br><small class="text-muted">${this.truncateText(course.description, 50)}</small>` : ''}
                            </td>
                            <td>${course.credits}</td>
                            <td>
                                <span class="badge ${this.getCourseTypeBadgeClass(course.type)}">
                                    ${course.type_name || course.type}
                                </span>
                            </td>
                            <td>${course.semester}</td>
                            <td>${course.teacher_name || '未分配'}</td>
                            <td>
                                <span class="badge ${course.current_enrollment < course.capacity ? 'bg-success' : 'bg-danger'}">
                                    ${course.current_enrollment} / ${course.capacity}
                                </span>
                            </td>
                            <td>${course.capacity}</td>
                            <td>${course.created_at ? formatDate(course.created_at) : '-'}</td>
                            <td>
                                <div class="btn-group btn-group-sm" role="group">
                                    <button class="btn btn-outline-primary" onclick="adminDashboard.showCourseDetail('${course.course_id}')">
                                        详情
                                    </button>
                                    <button class="btn btn-outline-info" onclick="adminDashboard.assignTeacherToCourse('${course.course_id}')">
                                        分配教师
                                    </button>
                                    <button class="btn btn-outline-danger" onclick="adminDashboard.showDeleteCourseModal('${course.course_id}', '${this.escapeString(course.course_name)}')">
                                        删除
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="alert alert-info mt-3">
                <i class="bi bi-info-circle"></i> 共 ${coursesToRender.length} 门课程
            </div>
        `;
    }

    /**
     * 筛选课程
     */
    filterCourses() {
        const type = document.getElementById('courseFilterType').value;
        const semester = document.getElementById('courseFilterSemester').value;
        const keyword = document.getElementById('courseSearch').value.toLowerCase().trim();

        const filteredCourses = this.courses.filter(course => {
            // 按类型筛选
            if (type && course.type !== type) return false;

            // 按学期筛选
            if (semester && course.semester !== semester) return false;

            // 按关键词筛选
            if (keyword) {
                const searchFields = [
                    course.course_id,
                    course.course_name,
                    course.description,
                    course.teacher_name
                ].filter(field => field);

                return searchFields.some(field =>
                    field.toLowerCase().includes(keyword)
                );
            }

            return true;
        });

        this.renderCourseTable(filteredCourses);
    }

    /**
     * 显示创建课程模态框
     */
    showCreateCourseModal() {
        const modalHTML = `
            <div class="modal fade" id="createCourseModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">创建新课程</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="createCourseForm">
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">课程号 <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" id="newCourseId" required 
                                               placeholder="如：CS101">
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">课程名称 <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" id="newCourseName" required 
                                               placeholder="如：信息安全导论">
                                    </div>
                                </div>
                                
                                <div class="row">
                                    <div class="col-md-4 mb-3">
                                        <label class="form-label">学分 <span class="text-danger">*</span></label>
                                        <input type="number" class="form-control" id="newCourseCredits" required 
                                               value="2.0" step="0.5" min="0.5" max="10">
                                    </div>
                                    <div class="col-md-4 mb-3">
                                        <label class="form-label">学时 <span class="text-danger">*</span></label>
                                        <input type="number" class="form-control" id="newCourseHours" required 
                                               value="32" min="16" max="128">
                                    </div>
                                    <div class="col-md-4 mb-3">
                                        <label class="form-label">课程类型 <span class="text-danger">*</span></label>
                                        <select class="form-select" id="newCourseType" required>
                                            <option value="compulsory">必修</option>
                                            <option value="elective" selected>选修</option>
                                            <option value="general">通识</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">学期 <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" id="newCourseSemester" required 
                                               placeholder="如：2024-2025-1" value="${new Date().getFullYear()}-${new Date().getFullYear() + 1}-1">
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">容量</label>
                                        <input type="number" class="form-control" id="newCourseCapacity" 
                                               value="50" min="10" max="200">
                                    </div>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label">课程描述</label>
                                    <textarea class="form-control" id="newCourseDescription" rows="3"></textarea>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label">分配教师（可选）</label>
                                    <select class="form-select" id="newCourseTeacher">
                                        <option value="">不分配教师</option>
                                        ${this.teachers.map(teacher => `
                                            <option value="${teacher.teacher_id}">${teacher.name} (${teacher.teacher_id}) - ${teacher.department || ''}</option>
                                        `).join('')}
                                    </select>
                                </div>
                                
                                <div id="teachingInfo" style="display: none;">
                                    <h6 class="border-bottom pb-2 mb-3">教学信息</h6>
                                    <div class="row">
                                        <div class="col-md-4 mb-3">
                                            <label class="form-label">教学班号</label>
                                            <input type="text" class="form-control" id="newCourseClassNo">
                                        </div>
                                        <div class="col-md-4 mb-3">
                                            <label class="form-label">上课时间</label>
                                            <input type="text" class="form-control" id="newCourseTeachingTime" 
                                                   placeholder="如：周一 1-2节">
                                        </div>
                                        <div class="col-md-4 mb-3">
                                            <label class="form-label">上课地点</label>
                                            <input type="text" class="form-control" id="newCourseLocation" 
                                                   placeholder="如：教101">
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                            <button type="button" class="btn btn-primary" onclick="adminDashboard.createCourse()">创建</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const modalContainer = document.getElementById('modalContainer') || document.createElement('div');
        modalContainer.id = 'modalContainer';
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer);

        // 显示模态框
        const modal = new bootstrap.Modal(document.getElementById('createCourseModal'));
        modal.show();

        // 根据是否选择教师显示/隐藏教学信息
        document.getElementById('newCourseTeacher').addEventListener('change', (e) => {
            const teachingInfo = document.getElementById('teachingInfo');
            teachingInfo.style.display = e.target.value ? 'block' : 'none';
        });
    }

    /**
     * 创建课程
     */
    async createCourse() {
        const courseId = document.getElementById('newCourseId').value.trim();
        const courseName = document.getElementById('newCourseName').value.trim();
        const credits = parseFloat(document.getElementById('newCourseCredits').value);
        const hours = parseInt(document.getElementById('newCourseHours').value);
        const type = document.getElementById('newCourseType').value;
        const semester = document.getElementById('newCourseSemester').value.trim();
        const capacity = parseInt(document.getElementById('newCourseCapacity').value);
        const description = document.getElementById('newCourseDescription').value.trim();
        const teacherId = document.getElementById('newCourseTeacher').value;

        if (!courseId || !courseName || !semester) {
            showMessage('请填写所有必填字段', 'warning');
            return;
        }

        const courseData = {
            course_id: courseId,
            course_name: courseName,
            credits: credits,
            hours: hours,
            type: type,
            semester: semester,
            capacity: capacity,
            description: description
        };

        // 如果选择了教师，添加教学信息
        if (teacherId) {
            courseData.teacher_id = teacherId;
            courseData.class_no = document.getElementById('newCourseClassNo').value.trim();
            courseData.teaching_time = document.getElementById('newCourseTeachingTime').value.trim();
            courseData.location = document.getElementById('newCourseLocation').value.trim();
        }

        try {
            const response = await callAPI('/admin/courses', {
                method: 'POST',
                body: courseData
            });

            if (response.success) {
                showMessage('课程创建成功！', 'success');
                bootstrap.Modal.getInstance(document.getElementById('createCourseModal')).hide();
                await this.loadCourseData();
            } else {
                showMessage(response.error || '创建课程失败', 'danger');
            }
        } catch (error) {
            console.error('创建课程失败:', error);
            showMessage('创建课程失败，请重试', 'danger');
        }
    }

    /**
     * 显示课程详情
     */
    async showCourseDetail(courseId) {
        try {
            // 从现有数据中查找课程
            const course = this.courses.find(c => c.course_id === courseId);
            if (!course) {
                showMessage('未找到课程信息', 'warning');
                return;
            }

            // 获取课程详情
            const response = await callAPI(`/course/${courseId}`);
            if (!response.success) {
                showMessage('获取课程详情失败', 'warning');
                return;
            }

            const courseDetail = this.extractData(response);

            const modalHTML = `
                <div class="modal fade" id="courseDetailModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">课程详情 - ${courseDetail.course_name} (${courseDetail.course_id})</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row">
                                    <div class="col-md-6">
                                        <table class="table table-sm">
                                            <tr>
                                                <th width="40%">课程号：</th>
                                                <td>${courseDetail.course_id}</td>
                                            </tr>
                                            <tr>
                                                <th>课程名称：</th>
                                                <td>${courseDetail.course_name}</td>
                                            </tr>
                                            <tr>
                                                <th>学分：</th>
                                                <td>${courseDetail.credits}</td>
                                            </tr>
                                            <tr>
                                                <th>学时：</th>
                                                <td>${courseDetail.hours}</td>
                                            </tr>
                                            <tr>
                                                <th>课程类型：</th>
                                                <td>
                                                    <span class="badge ${this.getCourseTypeBadgeClass(courseDetail.type)}">
                                                        ${courseDetail.type === 'compulsory' ? '必修' : courseDetail.type === 'elective' ? '选修' : '通识'}
                                                    </span>
                                                </td>
                                            </tr>
                                        </table>
                                    </div>
                                    <div class="col-md-6">
                                        <table class="table table-sm">
                                            <tr>
                                                <th width="40%">学期：</th>
                                                <td>${courseDetail.semester}</td>
                                            </tr>
                                            <tr>
                                                <th>容量：</th>
                                                <td>${courseDetail.capacity} 人</td>
                                            </tr>
                                            <tr>
                                                <th>当前选课：</th>
                                                <td>${courseDetail.current_enrollment} 人</td>
                                            </tr>
                                            <tr>
                                                <th>剩余名额：</th>
                                                <td>${courseDetail.capacity - courseDetail.current_enrollment} 人</td>
                                            </tr>
                                            <tr>
                                                <th>创建时间：</th>
                                                <td>${courseDetail.created_at ? formatDate(courseDetail.created_at) : '-'}</td>
                                            </tr>
                                        </table>
                                    </div>
                                </div>
                                
                                <div class="row mt-3">
                                    <div class="col-md-12">
                                        <h6>课程描述</h6>
                                        <p>${courseDetail.description || '暂无描述'}</p>
                                    </div>
                                </div>
                                
                                ${courseDetail.teacher_info?.teacher_id ? `
                                    <div class="row mt-3">
                                        <div class="col-md-12">
                                            <h6>授课教师信息</h6>
                                            <table class="table table-sm">
                                                <tr>
                                                    <th width="20%">教师：</th>
                                                    <td>${courseDetail.teacher_info.name} (${courseDetail.teacher_info.teacher_id})</td>
                                                </tr>
                                                <tr>
                                                    <th>职称：</th>
                                                    <td>${courseDetail.teacher_info.title || '-'}</td>
                                                </tr>
                                                <tr>
                                                    <th>院系：</th>
                                                    <td>${courseDetail.teacher_info.department || '-'}</td>
                                                </tr>
                                            </table>
                                        </div>
                                    </div>
                                    
                                    ${courseDetail.teaching_info ? `
                                        <div class="row mt-3">
                                            <div class="col-md-12">
                                                <h6>教学安排</h6>
                                                <table class="table table-sm">
                                                    <tr>
                                                        <th width="20%">教学班号：</th>
                                                        <td>${courseDetail.teaching_info.class_no || '-'}</td>
                                                    </tr>
                                                    <tr>
                                                        <th>上课时间：</th>
                                                        <td>${courseDetail.teaching_info.teaching_time || '-'}</td>
                                                    </tr>
                                                    <tr>
                                                        <th>上课地点：</th>
                                                        <td>${courseDetail.teaching_info.location || '-'}</td>
                                                    </tr>
                                                </table>
                                            </div>
                                        </div>
                                    ` : ''}
                                ` : `
                                    <div class="alert alert-warning mt-3">
                                        <i class="bi bi-exclamation-triangle"></i> 该课程尚未分配教师
                                    </div>
                                `}
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
                                <button type="button" class="btn btn-primary" onclick="adminDashboard.assignTeacherToCourse('${courseId}')">分配教师</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            const modalContainer = document.getElementById('modalContainer') || document.createElement('div');
            modalContainer.id = 'modalContainer';
            modalContainer.innerHTML = modalHTML;
            document.body.appendChild(modalContainer);

            const modal = new bootstrap.Modal(document.getElementById('courseDetailModal'));
            modal.show();

        } catch (error) {
            console.error('显示课程详情失败:', error);
            showMessage('显示课程详情失败', 'danger');
        }
    }

    /**
     * 为课程分配教师
     */
    async assignTeacherToCourse(courseId) {
        try {
            // 从现有数据中查找课程
            const course = this.courses.find(c => c.course_id === courseId);
            if (!course) {
                showMessage('未找到课程信息', 'warning');
                return;
            }

            // 获取课程当前的教师信息
            const response = await callAPI(`/course/${courseId}`);
            const courseDetail = response.success ? this.extractData(response) : {};

            const modalHTML = `
                <div class="modal fade" id="assignTeacherModal" tabindex="-1">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">分配教师 - ${course.course_name} (${courseId})</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <form id="assignTeacherForm">
                                    <div class="mb-3">
                                        <label class="form-label">选择教师</label>
                                        <select class="form-select" id="assignTeacherId" required>
                                            <option value="">请选择教师</option>
                                            ${this.teachers.map(teacher => `
                                                <option value="${teacher.teacher_id}" 
                                                        ${courseDetail.teacher_info?.teacher_id === teacher.teacher_id ? 'selected' : ''}>
                                                    ${teacher.name} (${teacher.teacher_id}) - ${teacher.department || ''}
                                                </option>
                                            `).join('')}
                                        </select>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">教学班号</label>
                                        <input type="text" class="form-control" id="assignClassNo" 
                                               value="${courseDetail.teaching_info?.class_no || ''}">
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">上课时间</label>
                                        <input type="text" class="form-control" id="assignTeachingTime" 
                                               value="${courseDetail.teaching_info?.teaching_time || ''}" 
                                               placeholder="如：周一 1-2节">
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">上课地点</label>
                                        <input type="text" class="form-control" id="assignLocation" 
                                               value="${courseDetail.teaching_info?.location || ''}" 
                                               placeholder="如：教101">
                                    </div>
                                    
                                    ${courseDetail.teacher_info?.teacher_id ? `
                                        <div class="alert alert-warning">
                                            <i class="bi bi-exclamation-triangle"></i> 
                                            该课程已有教师：${courseDetail.teacher_info.name}
                                        </div>
                                    ` : ''}
                                </form>
                            </div>
                            <div class="modal-footer">
                                ${courseDetail.teacher_info?.teacher_id ? `
                                    <button type="button" class="btn btn-danger" onclick="adminDashboard.removeTeacherFromCourse('${courseId}')">移除教师</button>
                                ` : ''}
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                                <button type="button" class="btn btn-primary" onclick="adminDashboard.saveTeacherAssignment('${courseId}')">保存分配</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            const modalContainer = document.getElementById('modalContainer') || document.createElement('div');
            modalContainer.id = 'modalContainer';
            modalContainer.innerHTML = modalHTML;
            document.body.appendChild(modalContainer);

            const modal = new bootstrap.Modal(document.getElementById('assignTeacherModal'));
            modal.show();

        } catch (error) {
            console.error('分配教师失败:', error);
            showMessage('分配教师失败', 'danger');
        }
    }

    /**
     * 保存教师分配
     */
    async saveTeacherAssignment(courseId) {
        const teacherId = document.getElementById('assignTeacherId').value;
        const classNo = document.getElementById('assignClassNo').value.trim();
        const teachingTime = document.getElementById('assignTeachingTime').value.trim();
        const location = document.getElementById('assignLocation').value.trim();

        if (!teacherId) {
            showMessage('请选择教师', 'warning');
            return;
        }

        const assignmentData = {
            teacher_id: teacherId,
            class_no: classNo || null,
            teaching_time: teachingTime || null,
            location: location || null
        };

        try {
            const response = await callAPI(`/admin/courses/${courseId}/assign-teacher`, {
                method: 'POST',
                body: assignmentData
            });

            if (response.success) {
                showMessage('教师分配成功！', 'success');
                bootstrap.Modal.getInstance(document.getElementById('assignTeacherModal')).hide();
                await this.loadCourseData();
            } else {
                showMessage(response.error || '分配教师失败', 'danger');
            }
        } catch (error) {
            console.error('分配教师失败:', error);
            showMessage('分配教师失败，请重试', 'danger');
        }
    }

    /**
     * 从课程移除教师
     */
    async removeTeacherFromCourse(courseId) {
        if (!confirm('确定要从该课程移除教师吗？')) return;

        try {
            const response = await callAPI(`/admin/courses/${courseId}/remove-teacher`, {
                method: 'POST'
            });

            if (response.success) {
                showMessage('教师移除成功！', 'success');
                bootstrap.Modal.getInstance(document.getElementById('assignTeacherModal')).hide();
                await this.loadCourseData();
            } else {
                showMessage(response.error || '移除教师失败', 'danger');
            }
        } catch (error) {
            console.error('移除教师失败:', error);
            showMessage('移除教师失败，请重试', 'danger');
        }
    }

    /**
     * 显示删除课程模态框
     */
    showDeleteCourseModal(courseId, courseName) {
        const modalHTML = `
            <div class="modal fade" id="deleteCourseModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title text-danger">删除课程</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-danger">
                                <i class="bi bi-exclamation-triangle"></i> 
                                <strong>警告：此操作不可撤销！</strong>
                            </div>
                            <p>确定要删除课程 <strong>${courseName}</strong> 吗？</p>
                            <p class="text-muted">注意：如果课程已有学生选课，将无法删除。</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                            <button type="button" class="btn btn-danger" onclick="adminDashboard.deleteCourse('${courseId}')">删除课程</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const modalContainer = document.getElementById('modalContainer') || document.createElement('div');
        modalContainer.id = 'modalContainer';
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer);

        const modal = new bootstrap.Modal(document.getElementById('deleteCourseModal'));
        modal.show();
    }

    /**
     * 删除课程
     */
    async deleteCourse(courseId) {
        try {
            // 注意：这里需要使用课程管理员的删除API
            // 由于我们没有单独的API，我们先使用普通删除API
            const response = await callAPI(`/course/${courseId}`, {
                method: 'DELETE'
            });

            if (response.success) {
                showMessage('课程删除成功', 'success');
                bootstrap.Modal.getInstance(document.getElementById('deleteCourseModal')).hide();
                await this.loadCourseData();
            } else {
                showMessage(response.error || '删除课程失败', 'danger');
            }
        } catch (error) {
            console.error('删除课程失败:', error);
            showMessage('删除课程失败，请重试', 'danger');
        }
    }

    // ==================== 操作审计页面 ====================

    /**
     * 加载操作审计页面
     */
    async loadAuditLogs() {
        console.log('加载操作审计...');
        const mainContent = document.getElementById('mainContent');

        mainContent.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4>操作审计</h4>
                <div>
                    <button class="btn btn-outline-primary" onclick="adminDashboard.loadAuditData()">
                        <i class="bi bi-arrow-clockwise"></i> 刷新
                    </button>
                    <button class="btn btn-outline-info ms-2" onclick="adminDashboard.showAuditStatistics()">
                        <i class="bi bi-bar-chart"></i> 统计
                    </button>
                </div>
            </div>
            
            <!-- 筛选工具栏 -->
            <div class="card mb-4">
                <div class="card-body">
                    <div class="row g-3">
                        <div class="col-md-3">
                            <input type="text" class="form-control" id="auditFilterUser" 
                                   placeholder="用户ID" onchange="adminDashboard.filterAuditLogs()">
                        </div>
                        <div class="col-md-3">
                            <select class="form-select" id="auditFilterType" onchange="adminDashboard.filterAuditLogs()">
                                <option value="">所有操作类型</option>
                                <option value="login">登录</option>
                                <option value="logout">注销</option>
                                <option value="create_user">创建用户</option>
                                <option value="update_user">更新用户</option>
                                <option value="delete_user">删除用户</option>
                                <option value="reset_password">重置密码</option>
                                <option value="update_student">更新学生</option>
                                <option value="batch_update_students">批量更新学生</option>
                                <option value="update_teacher">更新教师</option>
                                <option value="create_course">创建课程</option>
                                <option value="update_course">更新课程</option>
                                <option value="delete_course">删除课程</option>
                                <option value="assign_teacher">分配教师</option>
                                <option value="remove_teacher">移除教师</option>
                                <option value="update_grade">更新成绩</option>
                                <option value="batch_update_grades">批量更新成绩</option>
                                <option value="enroll_course">选课</option>
                                <option value="drop_course">退课</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <select class="form-select" id="auditFilterResult" onchange="adminDashboard.filterAuditLogs()">
                                <option value="">所有结果</option>
                                <option value="success">成功</option>
                                <option value="failure">失败</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <div class="input-group">
                                <input type="text" class="form-control" id="auditSearch" 
                                       placeholder="搜索描述..." 
                                       onkeyup="adminDashboard.filterAuditLogs()">
                                <button class="btn btn-outline-secondary" type="button" onclick="adminDashboard.filterAuditLogs()">
                                    <i class="bi bi-search"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="row g-3 mt-2">
                        <div class="col-md-6">
                            <label class="form-label">开始日期</label>
                            <input type="datetime-local" class="form-control" id="auditStartDate" 
                                   onchange="adminDashboard.filterAuditLogs()">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">结束日期</label>
                            <input type="datetime-local" class="form-control" id="auditEndDate" 
                                   onchange="adminDashboard.filterAuditLogs()">
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 审计日志表格 -->
            <div class="table-responsive" id="auditTableContainer">
                <div class="text-center py-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">加载中...</span>
                    </div>
                    <p class="mt-3">正在加载审计日志...</p>
                </div>
            </div>
        `;

        // 设置日期默认值（最近7天）
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        document.getElementById('auditStartDate').value = sevenDaysAgo.toISOString().slice(0, 16);
        document.getElementById('auditEndDate').value = now.toISOString().slice(0, 16);

        // 加载审计数据
        await this.loadAuditData();
    }

    /**
     * 加载审计数据
     */
    async loadAuditData() {
        try {
            // 构建查询参数
            const params = new URLSearchParams();

            const user = document.getElementById('auditFilterUser')?.value;
            const type = document.getElementById('auditFilterType')?.value;
            const result = document.getElementById('auditFilterResult')?.value;
            const startDate = document.getElementById('auditStartDate')?.value;
            const endDate = document.getElementById('auditEndDate')?.value;
            const keyword = document.getElementById('auditSearch')?.value;

            if (user) params.append('user_id', user);
            if (type) params.append('action_type', type);
            if (result) params.append('result', result);
            if (startDate) params.append('start_date', startDate + ':00');
            if (endDate) params.append('end_date', endDate + ':00');
            if (keyword) params.append('keyword', keyword);

            const url = `/admin/audit-logs${params.toString() ? '?' + params.toString() : ''}`;
            const response = await callAPI(url);

            if (!response.success) {
                showMessage('获取审计日志失败: ' + (response.error || '未知错误'), 'danger');
                return;
            }

            const data = this.extractData(response);
            this.auditLogs = data?.logs || [];
            this.auditStats = data?.statistics;

            this.renderAuditTable();
        } catch (error) {
            console.error('加载审计数据失败:', error);
            showMessage('加载审计数据失败，请重试', 'danger');
        }
    }

    /**
     * 渲染审计表格
     */
    renderAuditTable(filteredLogs = null) {
        const logsToRender = filteredLogs || this.auditLogs;
        const container = document.getElementById('auditTableContainer');

        if (!container) return;

        if (logsToRender.length === 0) {
            container.innerHTML = `
                <div class="alert alert-warning">
                    <i class="bi bi-journal"></i> 没有找到审计日志
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="table table-hover">
                <thead class="table-light">
                    <tr>
                        <th>时间</th>
                        <th>用户</th>
                        <th>角色</th>
                        <th>操作类型</th>
                        <th>描述</th>
                        <th>IP地址</th>
                        <th>结果</th>
                    </tr>
                </thead>
                <tbody>
                    ${logsToRender.map(log => `
                        <tr>
                            <td>${formatDate(log.timestamp)}</td>
                            <td>
                                ${log.username || log.user_id}
                                <br>
                                <small class="text-muted">${log.user_id}</small>
                            </td>
                            <td>
                                <span class="badge ${this.getRoleBadgeClass(log.user_role)}">
                                    ${this.getRoleText(log.user_role)}
                                </span>
                            </td>
                            <td>${this.getActionTypeText(log.action_type)}</td>
                            <td>${log.description || '-'}</td>
                            <td>${log.ip_address || '-'}</td>
                            <td>
                                <span class="badge ${log.result === 'success' ? 'bg-success' : 'bg-danger'}">
                                    ${log.result === 'success' ? '成功' : '失败'}
                                </span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ${this.auditStats ? `
                <div class="alert alert-info mt-3">
                    <i class="bi bi-info-circle"></i> 
                    共 ${this.auditStats.total} 条日志，成功 ${this.auditStats.success} 条，失败 ${this.auditStats.failure} 条
                </div>
            ` : ''}
        `;
    }

    /**
     * 筛选审计日志
     */
    filterAuditLogs() {
        this.loadAuditData(); // 重新加载数据（因为需要服务器端筛选）
    }

    /**
     * 显示审计统计
     */
    async showAuditStatistics() {
        try {
            const response = await callAPI('/admin/audit-logs/statistics');
            if (!response.success) {
                showMessage('获取审计统计失败', 'warning');
                return;
            }

            const stats = this.extractData(response);

            const modalHTML = `
                <div class="modal fade" id="auditStatisticsModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">审计统计（最近7天）</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row">
                                    <div class="col-md-6">
                                        <h6>按操作类型统计</h6>
                                        <div class="table-responsive">
                                            <table class="table table-sm">
                                                <thead>
                                                    <tr>
                                                        <th>操作类型</th>
                                                        <th>数量</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${stats.by_type.map(item => `
                                                        <tr>
                                                            <td>${this.getActionTypeText(item.action_type)}</td>
                                                            <td><span class="badge bg-primary">${item.count}</span></td>
                                                        </tr>
                                                    `).join('')}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <h6>按用户统计</h6>
                                        <div class="table-responsive">
                                            <table class="table table-sm">
                                                <thead>
                                                    <tr>
                                                        <th>用户</th>
                                                        <th>操作数量</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${stats.by_user.map(item => `
                                                        <tr>
                                                            <td>${item.user_id}</td>
                                                            <td><span class="badge bg-info">${item.count}</span></td>
                                                        </tr>
                                                    `).join('')}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="row mt-4">
                                    <div class="col-md-6">
                                        <h6>按结果统计</h6>
                                        <div class="table-responsive">
                                            <table class="table table-sm">
                                                <thead>
                                                    <tr>
                                                        <th>结果</th>
                                                        <th>数量</th>
                                                        <th>比例</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${stats.by_result.map(item => {
                const total = stats.by_result.reduce((sum, i) => sum + i.count, 0);
                const percentage = total > 0 ? Math.round(item.count / total * 100) : 0;
                return `
                                                            <tr>
                                                                <td>${item.result === 'success' ? '成功' : '失败'}</td>
                                                                <td><span class="badge ${item.result === 'success' ? 'bg-success' : 'bg-danger'}">${item.count}</span></td>
                                                                <td>${percentage}%</td>
                                                            </tr>
                                                        `;
            }).join('')}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <h6>每日统计</h6>
                                        <div class="table-responsive">
                                            <table class="table table-sm">
                                                <thead>
                                                    <tr>
                                                        <th>日期</th>
                                                        <th>操作数量</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${stats.daily.map(item => `
                                                        <tr>
                                                            <td>${item.date ? item.date.split('T')[0] : '未知'}</td>
                                                            <td><span class="badge bg-secondary">${item.count}</span></td>
                                                        </tr>
                                                    `).join('')}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="alert alert-info mt-4">
                                    <i class="bi bi-calendar"></i> 
                                    统计时间范围：${formatDate(stats.time_range.start)} 至 ${formatDate(stats.time_range.end)}
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            const modalContainer = document.getElementById('modalContainer') || document.createElement('div');
            modalContainer.id = 'modalContainer';
            modalContainer.innerHTML = modalHTML;
            document.body.appendChild(modalContainer);

            const modal = new bootstrap.Modal(document.getElementById('auditStatisticsModal'));
            modal.show();

        } catch (error) {
            console.error('显示审计统计失败:', error);
            showMessage('显示审计统计失败', 'danger');
        }
    }

    // ==================== 安全监控页面 ====================

    /**
     * 加载安全监控页面
     */
    async loadSecurity() {
        console.log('加载安全监控...');
        const mainContent = document.getElementById('mainContent');

        mainContent.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4>数据安全监控</h4>
                <div>
                    <button class="btn btn-primary" onclick="adminDashboard.runSecurityCheck()">
                        <i class="bi bi-shield-check"></i> 运行安全检查
                    </button>
                    <button class="btn btn-outline-primary ms-2" onclick="adminDashboard.loadPage('security')">
                        <i class="bi bi-arrow-clockwise"></i> 刷新
                    </button>
                </div>
            </div>
            
            <div class="alert alert-info">
                <strong><i class="bi bi-info-circle"></i> 系统安全状态</strong>
                <p class="mb-0 mt-2">系统使用AES-256加密存储敏感数据，SHA-256哈希保护成绩完整性。</p>
            </div>
            
            <div id="securityReportContainer">
                <div class="text-center py-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">加载中...</span>
                    </div>
                    <p class="mt-3">正在加载安全报告...</p>
                </div>
            </div>
        `;

        // 加载安全报告
        await this.loadSecurityReport();
    }

    /**
     * 加载安全报告
     */
    async loadSecurityReport() {
        try {
            const response = await callAPI('/admin/security-check');
            if (!response.success) {
                showMessage('获取安全报告失败: ' + (response.error || '未知错误'), 'danger');
                return;
            }

            this.securityReport = this.extractData(response);
            this.renderSecurityReport();
        } catch (error) {
            console.error('加载安全报告失败:', error);
            showMessage('加载安全报告失败，请重试', 'danger');
        }
    }

    /**
     * 渲染安全报告
     */
    renderSecurityReport() {
        const container = document.getElementById('securityReportContainer');
        if (!container || !this.securityReport) return;

        const report = this.securityReport;
        const encryption = report.encryption_status?.students;
        const integrity = report.grade_integrity;
        const system = report.system_status;

        // 计算总体安全分数
        const securityScore = report.security_score || 0;
        const securityLevel = report.security_level || '未知';

        // 确定安全等级颜色
        let securityColor = 'danger';
        if (securityScore >= 90) securityColor = 'success';
        else if (securityScore >= 75) securityColor = 'info';
        else if (securityScore >= 60) securityColor = 'warning';

        container.innerHTML = `
            <!-- 总体安全状态 -->
            <div class="card mb-4">
                <div class="card-header bg-${securityColor} text-white">
                    <h5 class="mb-0">🔐 总体安全状态</h5>
                </div>
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-3 text-center">
                            <div class="display-4 fw-bold text-${securityColor}">${securityScore}</div>
                            <div class="fs-5">安全分数</div>
                        </div>
                        <div class="col-md-9">
                            <div class="progress mb-3" style="height: 30px;">
                                <div class="progress-bar bg-${securityColor}" role="progressbar" 
                                     style="width: ${securityScore}%" aria-valuenow="${securityScore}" 
                                     aria-valuemin="0" aria-valuemax="100">
                                    ${securityScore}%
                                </div>
                            </div>
                            <div class="text-center">
                                <span class="badge bg-${securityColor} fs-6">${securityLevel}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 敏感数据加密状态 -->
            <div class="card mb-4">
                <div class="card-header">
                    <h5 class="mb-0">🛡️ 敏感数据加密状态</h5>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <h6>身份证号加密</h6>
                            <div class="d-flex align-items-center mb-3">
                                <div class="flex-grow-1">
                                    <div class="progress" style="height: 20px;">
                                        <div class="progress-bar ${encryption?.id_card?.encrypted_percentage === 100 ? 'bg-success' : 'bg-warning'}" 
                                             role="progressbar" style="width: ${encryption?.id_card?.encrypted_percentage || 0}%">
                                            ${encryption?.id_card?.encrypted_percentage || 0}%
                                        </div>
                                    </div>
                                </div>
                                <div class="ms-3">
                                    <span class="badge ${encryption?.id_card?.encrypted_percentage === 100 ? 'bg-success' : 'bg-warning'}">
                                        ${encryption?.id_card?.encrypted || 0}/${encryption?.total || 0}
                                    </span>
                                </div>
                            </div>
                            <p class="small text-muted">
                                ${encryption?.id_card?.decryptable_percentage === 100 ? '✅ 所有加密数据可正常解密' : '⚠️ 部分加密数据无法解密'}
                            </p>
                        </div>
                        <div class="col-md-6">
                            <h6>手机号加密</h6>
                            <div class="d-flex align-items-center mb-3">
                                <div class="flex-grow-1">
                                    <div class="progress" style="height: 20px;">
                                        <div class="progress-bar ${encryption?.phone?.encrypted_percentage === 100 ? 'bg-success' : 'bg-warning'}" 
                                             role="progressbar" style="width: ${encryption?.phone?.encrypted_percentage || 0}%">
                                            ${encryption?.phone?.encrypted_percentage || 0}%
                                        </div>
                                    </div>
                                </div>
                                <div class="ms-3">
                                    <span class="badge ${encryption?.phone?.encrypted_percentage === 100 ? 'bg-success' : 'bg-warning'}">
                                        ${encryption?.phone?.encrypted || 0}/${encryption?.total || 0}
                                    </span>
                                </div>
                            </div>
                            <p class="small text-muted">
                                ${encryption?.phone?.decryptable_percentage === 100 ? '✅ 所有加密数据可正常解密' : '⚠️ 部分加密数据无法解密'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 成绩完整性保护 -->
            <div class="card mb-4">
                <div class="card-header">
                    <h5 class="mb-0">📊 成绩完整性保护</h5>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <h6>成绩哈希保护</h6>
                            <div class="d-flex align-items-center mb-3">
                                <div class="flex-grow-1">
                                    <div class="progress" style="height: 20px;">
                                        <div class="progress-bar ${integrity?.has_hash_percentage === 100 ? 'bg-success' : 'bg-warning'}" 
                                             role="progressbar" style="width: ${integrity?.has_hash_percentage || 0}%">
                                            ${integrity?.has_hash_percentage || 0}%
                                        </div>
                                    </div>
                                </div>
                                <div class="ms-3">
                                    <span class="badge ${integrity?.has_hash_percentage === 100 ? 'bg-success' : 'bg-warning'}">
                                        ${integrity?.has_hash || 0}/${integrity?.total_grades || 0}
                                    </span>
                                </div>
                            </div>
                            <p class="small text-muted">
                                ${integrity?.has_hash_percentage === 100 ? '✅ 所有成绩都有完整性保护' : '⚠️ 部分成绩未进行完整性保护'}
                            </p>
                        </div>
                        <div class="col-md-6">
                            <h6>哈希验证通过率</h6>
                            <div class="d-flex align-items-center mb-3">
                                <div class="flex-grow-1">
                                    <div class="progress" style="height: 20px;">
                                        <div class="progress-bar ${integrity?.verified_percentage === 100 ? 'bg-success' : 'bg-danger'}" 
                                             role="progressbar" style="width: ${integrity?.verified_percentage || 0}%">
                                            ${integrity?.verified_percentage || 0}%
                                        </div>
                                    </div>
                                </div>
                                <div class="ms-3">
                                    <span class="badge ${integrity?.verified_percentage === 100 ? 'bg-success' : 'bg-danger'}">
                                        ${integrity?.verified || 0}/${integrity?.has_hash || 0}
                                    </span>
                                </div>
                            </div>
                            <p class="small text-muted">
                                ${integrity?.verified_percentage === 100 ? '✅ 所有成绩哈希验证通过' : '❌ 部分成绩哈希验证失败，可能存在数据篡改'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 系统状态统计 -->
            <div class="card mb-4">
                <div class="card-header">
                    <h5 class="mb-0">📈 系统状态统计</h5>
                </div>
                <div class="card-body">
                    <div class="row text-center">
                        <div class="col-md-3 col-6 mb-3">
                            <div class="card bg-light">
                                <div class="card-body">
                                    <h3 class="text-primary">${system?.users_count || 0}</h3>
                                    <small class="text-muted">总用户数</small>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3 col-6 mb-3">
                            <div class="card bg-light">
                                <div class="card-body">
                                    <h3 class="text-success">${system?.courses_count || 0}</h3>
                                    <small class="text-muted">总课程数</small>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3 col-6 mb-3">
                            <div class="card bg-light">
                                <div class="card-body">
                                    <h3 class="text-info">${system?.enrollments_count || 0}</h3>
                                    <small class="text-muted">总选课数</small>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3 col-6 mb-3">
                            <div class="card bg-light">
                                <div class="card-body">
                                    <h3 class="text-warning">${system?.audit_logs_count || 0}</h3>
                                    <small class="text-muted">审计日志数</small>
                                </div>
                            </div>
                        </div>
                    </div>
                    <p class="text-muted small mb-0">
                        最后检查时间：${report.timestamp ? formatDate(report.timestamp) : '未知'}
                    </p>
                </div>
            </div>
            
            <!-- 安全建议 -->
            ${report.recommendations?.length > 0 ? `
                <div class="card">
                    <div class="card-header">
                        <h5 class="mb-0">💡 安全建议</h5>
                    </div>
                    <div class="card-body">
                        <ul class="list-group list-group-flush">
                            ${report.recommendations.map(rec => `
                                <li class="list-group-item">
                                    <i class="bi bi-exclamation-triangle text-warning me-2"></i>
                                    ${rec}
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            ` : `
                <div class="alert alert-success">
                    <i class="bi bi-check-circle"></i> 
                    系统安全状态良好，所有安全指标均符合要求。
                </div>
            `}
        `;
    }

    /**
     * 运行安全检查
     */
    async runSecurityCheck() {
        try {
            const button = document.querySelector('button[onclick="adminDashboard.runSecurityCheck()"]');
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="bi bi-hourglass-split"></i> 检查中...';
            button.disabled = true;

            // 重新加载安全报告
            await this.loadSecurityReport();

            button.innerHTML = originalText;
            button.disabled = false;

            showMessage('安全检查完成', 'success');
        } catch (error) {
            console.error('运行安全检查失败:', error);
            showMessage('安全检查失败，请重试', 'danger');
        }
    }

    // ==================== 用户注销 ====================

    /**
     * 用户注销
     */
    async logout() {
        if (confirm('确定要退出登录吗？')) {
            await logout(); // 使用common.js中的logout函数
        }
    }

    // ==================== 工具方法 ====================

    /**
     * 转义字符串（防止XSS）
     */
    escapeString(str) {
        if (!str) return '';
        return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
    }

    /**
     * 截断文本
     */
    truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    /**
     * 获取角色对应的徽章类
     */
    getRoleBadgeClass(role) {
        if (!role) return 'bg-light text-dark';

        switch (role) {
            case 'admin': return 'bg-danger';
            case 'teacher': return 'bg-info';
            case 'student': return 'bg-success';
            default: return 'bg-light text-dark';
        }
    }

    /**
     * 获取角色对应的文本
     */
    getRoleText(role) {
        if (!role) return '未知';

        const roleMap = {
            'admin': '管理员',
            'teacher': '教师',
            'student': '学生'
        };
        return roleMap[role] || role;
    }

    /**
     * 获取学生状态对应的徽章类
     */
    getStudentStatusBadgeClass(status) {
        if (!status) return 'bg-light text-dark';

        switch (status) {
            case 'active': return 'bg-success';
            case 'leave': return 'bg-warning';
            case 'graduated': return 'bg-secondary';
            default: return 'bg-light text-dark';
        }
    }

    /**
     * 获取学生状态对应的文本
     */
    getStudentStatusText(status) {
        if (!status) return '未知';

        const statusMap = {
            'active': '在读',
            'leave': '休学',
            'graduated': '已毕业'
        };
        return statusMap[status] || status;
    }

    /**
     * 获取课程类型对应的徽章类
     */
    getCourseTypeBadgeClass(type) {
        if (!type) return 'bg-light text-dark';

        switch (type) {
            case 'compulsory': return 'bg-primary';
            case 'elective': return 'bg-success';
            case 'general': return 'bg-info';
            default: return 'bg-light text-dark';
        }
    }

    /**
     * 获取操作类型对应的文本
     */
    getActionTypeText(actionType) {
        if (!actionType) return '未知';

        const actionMap = {
            'login': '登录',
            'logout': '注销',
            'create_user': '创建用户',
            'update_user': '更新用户',
            'delete_user': '删除用户',
            'reset_password': '重置密码',
            'update_student': '更新学生',
            'batch_update_students': '批量更新学生',
            'update_teacher': '更新教师',
            'create_course': '创建课程',
            'update_course': '更新课程',
            'delete_course': '删除课程',
            'assign_teacher': '分配教师',
            'remove_teacher': '移除教师',
            'update_grade': '更新成绩',
            'batch_update_grades': '批量更新成绩',
            'enroll_course': '选课',
            'drop_course': '退课'
        };
        return actionMap[actionType] || actionType;
    }
}

// ==================== 全局实例和初始化 ====================

// 创建全局实例
let adminDashboard;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM加载完成，开始初始化管理员仪表板...');

    // 检查是否在管理员仪表板页面
    const isAdminPage = document.getElementById('adminName') !== null;

    if (isAdminPage) {
        adminDashboard = new AdminDashboard();

        // 将实例附加到window对象，方便在HTML中调用
        window.adminDashboard = adminDashboard;

        // 延迟初始化，确保所有资源加载完成
        setTimeout(() => {
            adminDashboard.init();
        }, 100);
    }
});

console.log('admin.js 加载完成');