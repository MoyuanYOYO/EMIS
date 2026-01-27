// frontend/js/student.js - 学生端功能模块（修复版）
// 使用common.js中的函数：showMessage, callAPI, formatDate等

// ==================== 学生模块主类 ====================
class StudentDashboard {
    constructor() {
        this.currentUser = null;
        this.currentPage = 'dashboard';
        this.enrolledCourses = [];
        this.availableCourses = [];
        this.grades = [];

        console.log('StudentDashboard 初始化...');
    }

    // ==================== 辅助方法：数据格式处理 ====================

    /**
     * 从API响应中提取数据（处理多种格式）
     * @param {Object} response - callAPI返回的响应对象
     * @returns {any} 提取的数据
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

    /**
     * 从API响应中提取统计信息
     * @param {Object} response - callAPI返回的响应对象
     * @param {string} key - 要提取的键
     * @returns {any} 提取的值
     */
    extractStat(response, key) {
        if (!response || !response.success) {
            return null;
        }

        const data = response.data;
        let value = null;

        // 尝试多种格式
        if (data && data[key] !== undefined) {
            value = data[key];
        } else if (data && data.data && data.data[key] !== undefined) {
            value = data.data[key];
        } else if (data && data.statistics && data.statistics[key] !== undefined) {
            value = data.statistics[key];
        }

        return value;
    }

    // ==================== 初始化方法 ====================

    /**
     * 初始化学生仪表板
     */
    async init() {
        try {
            console.log('开始初始化学生仪表板...');

            // 1. 检查登录状态
            await this.checkAuth();

            // 2. 获取当前用户信息
            this.currentUser = await this.getCurrentUserInfo();
            if (!this.currentUser) {
                console.error('无法获取用户信息');
                window.location.href = '/';
                return;
            }

            // 3. 更新UI显示
            this.updateUserDisplay();

            // 4. 绑定事件
            this.bindEvents();

            // 5. 加载默认页面
            await this.loadPage('dashboard');

            console.log('StudentDashboard 初始化完成');

        } catch (error) {
            console.error('初始化失败:', error);
            this.showError('初始化失败，请刷新页面重试');
        }
    }

    // ==================== 认证和用户信息 ====================

    /**
     * 检查认证状态
     */
    async checkAuth() {
        console.log('检查认证状态...');
        const user = await getCurrentUser();
        if (!user || user.role !== 'student') {
            showMessage('请先登录学生账户', 'warning');
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
            throw new Error('未登录或非学生账户');
        }
        console.log('认证通过');
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
        const studentNameElement = document.getElementById('studentName');
        if (studentNameElement && this.currentUser) {
            studentNameElement.textContent = this.currentUser.name || this.currentUser.username || '学生';
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
                case 'profile':
                    await this.loadProfile();
                    break;
                case 'courses':
                    await this.loadEnrolledCourses();
                    break;
                case 'enrollment':
                    await this.loadEnrollmentPage();
                    break;
                case 'grades':
                    await this.loadGrades();
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
                <button class="btn btn-primary" onclick="studentDashboard.loadPage('dashboard')">
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
        console.log('加载仪表板...');
        const mainContent = document.getElementById('mainContent');

        try {
            // 获取统计数据
            const [coursesResponse, gradesResponse] = await Promise.all([
                callAPI('/student/courses/enrolled'),
                callAPI('/student/grades/statistics')
            ]);

            console.log('课程响应:', coursesResponse);
            console.log('成绩响应:', gradesResponse);

            // 处理课程数量
            let enrolledCount = 0;
            if (coursesResponse.success) {
                const coursesData = this.extractData(coursesResponse);
                if (Array.isArray(coursesData)) {
                    enrolledCount = coursesData.length;
                }
            }

            mainContent.innerHTML = `
                <h4 class="mb-4">学生仪表板</h4>
                
                <div class="alert alert-info">
                    <strong>欢迎回来，${this.currentUser.name || this.currentUser.username}同学！</strong>
                    <p class="mb-0 mt-2">请使用侧边栏菜单管理您的学习任务。</p>
                </div>
                
                <div class="row mt-4">
                    <div class="col-md-6 mb-3">
                        <div class="card">
                            <div class="card-header bg-primary text-white">
                                <h5 class="mb-0">个人信息</h5>
                            </div>
                            <div class="card-body">
                                <p><strong>学号：</strong>${this.currentUser.user_id || '未知'}</p>
                                <p><strong>院系：</strong>${this.currentUser.department || '未设置'}</p>
                                <p><strong>已选课程：</strong>${enrolledCount} 门</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-6 mb-3">
                        <div class="card">
                            <div class="card-header bg-success text-white">
                                <h5 class="mb-0">账号信息</h5>
                            </div>
                            <div class="card-body">
                                <p><strong>状态：</strong><span class="badge bg-success">在读</span></p>
                                <p><strong>上次登录：</strong>${this.currentUser.last_login ? formatDate(this.currentUser.last_login) : '首次登录'}</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="row mt-3">
                    <div class="col-12">
                        <div class="card">
                            <div class="card-header">
                                <h5 class="mb-0">快速操作</h5>
                            </div>
                            <div class="card-body">
                                <div class="row g-2">
                                    <div class="col-md-3 col-6">
                                        <button class="btn btn-outline-primary w-100" data-page="enrollment">
                                            选课中心
                                        </button>
                                    </div>
                                    <div class="col-md-3 col-6">
                                        <button class="btn btn-outline-success w-100" data-page="grades">
                                            成绩查询
                                        </button>
                                    </div>
                                    <div class="col-md-3 col-6">
                                        <button class="btn btn-outline-info w-100" data-page="courses">
                                            已选课程
                                        </button>
                                    </div>
                                    <div class="col-md-3 col-6">
                                        <button class="btn btn-outline-warning w-100" data-page="profile">
                                            个人资料
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="card mt-4">
                    <div class="card-header">
                        <h5 class="mb-0">系统公告</h5>
                    </div>
                    <div class="card-body">
                        <div class="alert alert-light border">
                            <p class="mb-1"><strong>📢 重要通知</strong></p>
                            <p class="mb-0">请同学们在规定时间内完成选课操作。</p>
                        </div>
                    </div>
                </div>
            `;

            // 绑定快速操作按钮事件
            mainContent.querySelectorAll('button[data-page]').forEach(button => {
                button.addEventListener('click', (e) => {
                    this.loadPage(e.target.dataset.page);
                });
            });

        } catch (error) {
            console.error('加载仪表板失败:', error);
            throw error;
        }
    }

    // ==================== 个人资料页面 ====================

    /**
     * 加载个人资料页面
     */
    async loadProfile() {
        console.log('加载个人资料...');
        const response = await callAPI('/student/profile');
        console.log('个人资料响应:', response);

        if (!response.success) {
            this.showError('获取个人资料失败');
            return;
        }

        let profile = response.data;
        if (response.data && response.data.data) {
            profile = response.data.data;
        }

        const mainContent = document.getElementById('mainContent');

        mainContent.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4>个人资料</h4>
                <div>
                    <button class="btn btn-primary" id="editProfileBtn">
                        <i class="bi bi-pencil"></i> 编辑资料
                    </button>
                    <!-- 修改密码按钮 -->
                    <button class="btn btn-outline-warning ms-2" id="changePasswordBtn">
                        <i class="bi bi-key"></i> 修改密码
                    </button>
                </div>
            </div>
            
            <div class="card">
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label class="form-label text-muted">学号</label>
                                <p class="fs-5">${profile.student_id || '未设置'}</p>
                            </div>
                            <div class="mb-3">
                                <label class="form-label text-muted">姓名</label>
                                <p class="fs-5">${profile.name || '未设置'}</p>
                            </div>
                            <div class="mb-3">
                                <label class="form-label text-muted">性别</label>
                                <p class="fs-5">${profile.gender || '未设置'}</p>
                            </div>
                            <div class="mb-3">
                                <label class="form-label text-muted">出生日期</label>
                                <p class="fs-5">${profile.birth_date ? formatDate(profile.birth_date) : '未设置'}</p>
                            </div>
                        </div>
                        
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label class="form-label text-muted">院系</label>
                                <p class="fs-5">${profile.department || '未设置'}</p>
                            </div>
                            <div class="mb-3">
                                <label class="form-label text-muted">专业</label>
                                <p class="fs-5">${profile.major || '未设置'}</p>
                            </div>
                            <div class="mb-3">
                                <label class="form-label text-muted">邮箱</label>
                                <p class="fs-5">${profile.email || '未设置'}</p>
                            </div>
                            <div class="mb-3">
                                <label class="form-label text-muted">入学年份</label>
                                <p class="fs-5">${profile.enrollment_year || '未设置'}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="row mt-3">
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label class="form-label text-muted">身份证号</label>
                                <p class="fs-5">${profile.id_card ? this.maskSensitiveInfo(profile.id_card, 'id') : '已加密'}</p>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label class="form-label text-muted">手机号</label>
                                <p class="fs-5">${profile.phone ? this.maskSensitiveInfo(profile.phone, 'phone') : '已加密'}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="alert alert-info mt-4">
                        <strong><i class="bi bi-shield-check"></i> 安全提示</strong>
                        <p class="mb-0">您的身份证号和手机号等敏感信息已使用AES-256加密存储，充分保护您的隐私安全。</p>
                    </div>
                </div>
            </div>
        `;

        // 绑定编辑按钮事件
        document.getElementById('editProfileBtn').addEventListener('click', () => {
            this.editProfile(profile);
        });
        // 绑定修改密码按钮事件
        document.getElementById('changePasswordBtn').addEventListener('click', () => {
            this.showChangePasswordModal();
        });
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
                                    <div class="form-text">至少6个字符，建议包含字母和数字</div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">确认新密码 <span class="text-danger">*</span></label>
                                    <input type="password" class="form-control" id="confirmPassword" required>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                            <button type="button" class="btn btn-primary" onclick="studentDashboard.submitChangePassword()">提交修改</button>
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
     * 新增：提交修改密码请求
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
                // 关闭模态框并注销
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


    /**
     * 编辑个人资料
     */
    async editProfile(profile) {
        console.log('编辑个人资料...');
        const mainContent = document.getElementById('mainContent');

        mainContent.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4>编辑个人资料</h4>
                <button class="btn btn-secondary" onclick="studentDashboard.loadPage('profile')">
                    <i class="bi bi-arrow-left"></i> 返回
                </button>
            </div>
            
            <div class="card">
                <div class="card-body">
                    <form id="editProfileForm">
                        <div class="row">
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <label class="form-label">学号</label>
                                    <input type="text" class="form-control" value="${profile.student_id || ''}" disabled>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">姓名</label>
                                    <input type="text" class="form-control" value="${profile.name || ''}" disabled>
                                    <div class="form-text">姓名不可修改，如需修改请联系管理员。</div>
                                </div>
                            </div>
                            
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <label class="form-label">邮箱</label>
                                    <input type="email" class="form-control" id="email" 
                                           value="${profile.email || ''}" 
                                           placeholder="请输入邮箱地址">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">手机号</label>
                                    <input type="tel" class="form-control" id="phone" 
                                           value="${profile.phone || ''}" 
                                           placeholder="请输入手机号" 
                                           pattern="[0-9]{11}">
                                    <div class="form-text">请输入11位手机号</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="alert alert-warning mt-3">
                            <strong><i class="bi bi-exclamation-triangle"></i> 提示</strong>
                            <p class="mb-0">姓名、学号、身份证号等核心信息不可修改，如需修改请联系管理员。</p>
                        </div>
                        
                        <div class="mt-4">
                            <button type="submit" class="btn btn-primary">
                                <i class="bi bi-check-circle"></i> 保存更改
                            </button>
                            <button type="button" class="btn btn-secondary" onclick="studentDashboard.loadPage('profile')">
                                取消
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // 绑定表单提交事件
        document.getElementById('editProfileForm').addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('email').value.trim();
            const phone = document.getElementById('phone').value.trim();

            // 验证邮箱格式
            if (email && !isValidEmail(email)) {
                showMessage('邮箱格式不正确', 'warning');
                return;
            }

            // 验证手机号格式
            if (phone && !isValidPhone(phone)) {
                showMessage('手机号格式不正确，请输入11位数字', 'warning');
                return;
            }

            // 显示加载状态
            const submitBtn = document.querySelector('#editProfileForm button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> 保存中...';
            submitBtn.disabled = true;

            try {
                const response = await callAPI('/student/profile', {
                    method: 'POST',
                    body: { email, phone }
                });

                console.log('更新个人资料响应:', response);

                if (response.success) {
                    showMessage('个人信息更新成功！', 'success');
                    setTimeout(() => this.loadPage('profile'), 1000);
                }
            } catch (error) {
                console.error('更新个人资料失败:', error);
                showMessage('更新失败，请稍后重试', 'danger');
            } finally {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    // ==================== 课程管理页面 ====================

    /**
     * 加载已选课程页面
     */
    async loadEnrolledCourses() {
        console.log('加载已选课程...');
        const response = await callAPI('/student/courses/enrolled');
        console.log('已选课程响应:', response);

        if (!response.success) {
            this.showError('获取已选课程失败');
            return;
        }

        const coursesData = this.extractData(response);
        this.enrolledCourses = Array.isArray(coursesData) ? coursesData : [];

        const mainContent = document.getElementById('mainContent');

        let coursesHTML = '';
        if (this.enrolledCourses.length === 0) {
            coursesHTML = `
                <div class="alert alert-warning">
                    <i class="bi bi-book"></i> 当前没有已选课程
                    <p class="mb-0 mt-2">请前往选课中心选择感兴趣的课程。</p>
                </div>
            `;
        } else {
            coursesHTML = `
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead class="table-light">
                            <tr>
                                <th>课程名称</th>
                                <th>课程号</th>
                                <th>学分</th>
                                <th>教师</th>
                                <th>选课时间</th>
                                <th>状态</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.enrolledCourses.map(course => {
                const courseName = course.course_name || '未知课程';
                const courseId = course.course_id || '未知';
                const enrollmentId = course.enrollment_id || 0;

                // 确保courseName是安全的（移除特殊字符）
                const safeCourseName = courseName.replace(/'/g, "\\'");

                return `
                                    <tr>
                                        <td>
                                            <strong>${courseName}</strong>
                                            ${course.description ? `<br><small class="text-muted">${this.truncateText(course.description, 50)}</small>` : ''}
                                        </td>
                                        <td>${courseId}</td>
                                        <td>${course.credits || '0'}</td>
                                        <td>${course.teacher_name || '未分配'}</td>
                                        <td>${course.enroll_time ? formatDate(course.enroll_time) : '-'}</td>
                                        <td>
                                            <span class="badge ${this.getStatusBadgeClass(course.status)}">
                                                ${this.getStatusText(course.status)}
                                            </span>
                                        </td>
                                        <td>
                                            ${course.status === 'enrolled' ? `
                                                <button class="btn btn-sm btn-danger" 
                                                        onclick="studentDashboard.dropCourse(${enrollmentId}, '${safeCourseName}')">
                                                    <i class="bi bi-trash"></i> 退选
                                                </button>
                                            ` : `
                                                <span class="text-muted">不可操作</span>
                                            `}
                                        </td>
                                    </tr>
                                `;
            }).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div class="alert alert-info mt-3">
                    <i class="bi bi-info-circle"></i> 共 ${this.enrolledCourses.length} 门已选课程
                </div>
            `;
        }

        mainContent.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4>已选课程</h4>
                <div>
                    <button class="btn btn-outline-primary" onclick="studentDashboard.loadPage('enrollment')">
                        <i class="bi bi-plus-circle"></i> 去选课
                    </button>
                    <button class="btn btn-outline-secondary ms-2" onclick="studentDashboard.loadEnrolledCourses()">
                        <i class="bi bi-arrow-clockwise"></i> 刷新
                    </button>
                </div>
            </div>
            
            ${coursesHTML}
        `;
    }

    /**
     * 加载选课中心页面
     */
    async loadEnrollmentPage() {
        console.log('加载选课中心...');

        try {
            // 同时获取可选课程和已选课程
            const [availableResponse, enrolledResponse] = await Promise.all([
                callAPI('/student/courses'),
                callAPI('/student/courses/enrolled')
            ]);

            console.log('可选课程响应:', availableResponse);
            console.log('已选课程响应:', enrolledResponse);

            // 处理数据格式
            const availableData = this.extractData(availableResponse);
            const enrolledData = this.extractData(enrolledResponse);

            this.availableCourses = Array.isArray(availableData) ? availableData : [];
            this.enrolledCourses = Array.isArray(enrolledData) ? enrolledData : [];

            const mainContent = document.getElementById('mainContent');

            mainContent.innerHTML = `
                <h4 class="mb-4">选课中心</h4>
                
                <ul class="nav nav-tabs mb-4" id="enrollmentTabs" role="tablist">
                    <li class="nav-item" role="presentation">
                        <button class="nav-link active" id="available-tab" data-bs-toggle="tab" 
                                data-bs-target="#available" type="button" role="tab">
                            <i class="bi bi-book"></i> 可选课程 (${this.availableCourses.length})
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="enrolled-tab" data-bs-toggle="tab" 
                                data-bs-target="#enrolled" type="button" role="tab">
                            <i class="bi bi-bookmark-check"></i> 已选课程 (${this.enrolledCourses.length})
                        </button>
                    </li>
                </ul>
                
                <div class="tab-content" id="enrollmentTabsContent">
                    <div class="tab-pane fade show active" id="available" role="tabpanel">
                        ${this.renderAvailableCourses()}
                    </div>
                    <div class="tab-pane fade" id="enrolled" role="tabpanel">
                        ${this.renderEnrolledCourses()}
                    </div>
                </div>
                
                <div class="alert alert-info mt-4">
                    <strong><i class="bi bi-lightbulb"></i> 选课说明</strong>
                    <ul class="mb-0 mt-2">
                        <li>请仔细阅读课程描述和上课时间，避免课程冲突</li>
                        <li>选课后如需调整，请在规定时间内完成退选操作</li>
                        <li>课程容量有限，请尽快选择感兴趣的课程</li>
                    </ul>
                </div>
            `;

            // 初始化Bootstrap标签页
            this.initTabs();

        } catch (error) {
            console.error('加载选课中心失败:', error);
            throw error;
        }
    }

    /**
     * 渲染可选课程
     */
    renderAvailableCourses() {
        console.log('渲染可选课程，数量:', this.availableCourses.length);

        if (!Array.isArray(this.availableCourses)) {
            this.availableCourses = [];
        }

        if (this.availableCourses.length === 0) {
            return `
                <div class="alert alert-warning">
                    <i class="bi bi-emoji-frown"></i> 当前无可选课程
                    <p class="mb-0 mt-2">可能原因：所有课程已满、不在选课时间或已选择所有可用课程。</p>
                </div>
            `;
        }

        return `
            <div class="row row-cols-1 row-cols-md-2 g-4">
                ${this.availableCourses.map(course => {
            const courseType = course.type || 'elective';
            const typeName = courseType === 'compulsory' ? '必修' :
                courseType === 'elective' ? '选修' : '通识';
            const typeClass = courseType === 'compulsory' ? 'bg-primary' :
                courseType === 'elective' ? 'bg-success' : 'bg-info';

            const courseId = course.course_id || '';
            const courseName = course.course_name || '未知课程';
            const safeCourseName = courseName.replace(/'/g, "\\'");

            const currentEnrollment = parseInt(course.current_enrollment) || 0;
            const capacity = parseInt(course.capacity) || 50;
            const availableSeats = capacity - currentEnrollment;

            return `
                        <div class="col">
                            <div class="card h-100 course-card">
                                <div class="card-header ${typeClass} text-white">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <strong>${courseName}</strong>
                                        <span class="badge bg-light text-dark">${typeName}</span>
                                    </div>
                                </div>
                                <div class="card-body">
                                    <p class="card-text">
                                        <strong>课程号：</strong>${courseId}<br>
                                        <strong>学分：</strong>${course.credits || '0'}<br>
                                        <strong>学时：</strong>${course.hours || '0'}<br>
                                        <strong>教师：</strong>${course.teacher_name || '未分配'}<br>
                                        <strong>学期：</strong>${course.semester || '未知'}<br>
                                        <strong>容量：</strong>${currentEnrollment}/${capacity}
                                        <span class="badge ${availableSeats > 5 ? 'bg-success' : 'bg-warning'}">
                                            剩余 ${availableSeats} 名额
                                        </span>
                                    </p>
                                    ${course.description ? `
                                        <p class="card-text"><small class="text-muted">${this.truncateText(course.description, 100)}</small></p>
                                    ` : ''}
                                </div>
                                <div class="card-footer bg-transparent">
                                    <button class="btn btn-success w-100" 
                                            onclick="studentDashboard.enrollCourse('${courseId}', '${safeCourseName}')">
                                        <i class="bi bi-plus-circle"></i> 选课
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    }

    /**
     * 渲染已选课程（选课中心用）
     */
    renderEnrolledCourses() {
        console.log('渲染已选课程，数量:', this.enrolledCourses.length);

        if (!Array.isArray(this.enrolledCourses)) {
            this.enrolledCourses = [];
        }

        if (this.enrolledCourses.length === 0) {
            return `
                <div class="alert alert-info">
                    <i class="bi bi-book"></i> 当前未选择任何课程
                    <p class="mb-0 mt-2">请在"可选课程"标签页中选择课程。</p>
                </div>
            `;
        }

        return `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead class="table-light">
                        <tr>
                            <th>课程名称</th>
                            <th>课程号</th>
                            <th>学分</th>
                            <th>教师</th>
                            <th>选课时间</th>
                            <th>状态</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.enrolledCourses.map(course => `
                            <tr>
                                <td>${course.course_name || '未知课程'}</td>
                                <td>${course.course_id || '未知'}</td>
                                <td>${course.credits || '0'}</td>
                                <td>${course.teacher_name || '未分配'}</td>
                                <td>${course.enroll_time ? formatDate(course.enroll_time) : '-'}</td>
                                <td>
                                    <span class="badge ${this.getStatusBadgeClass(course.status)}">
                                        ${this.getStatusText(course.status)}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    /**
     * 初始化Bootstrap标签页
     */
    initTabs() {
        const tabEls = document.querySelectorAll('#enrollmentTabs button[data-bs-toggle="tab"]');
        tabEls.forEach(tabEl => {
            tabEl.addEventListener('click', (e) => {
                const targetId = e.target.getAttribute('data-bs-target');
                const targetEl = document.querySelector(targetId);

                // 显示目标标签页内容
                document.querySelectorAll('.tab-pane').forEach(pane => {
                    pane.classList.remove('show', 'active');
                });
                if (targetEl) {
                    targetEl.classList.add('show', 'active');
                }

                // 更新标签页按钮状态
                tabEls.forEach(btn => {
                    btn.classList.remove('active');
                });
                e.target.classList.add('active');
            });
        });
    }

    // ==================== 成绩管理页面 ====================

    /**
     * 加载成绩页面
     */
    async loadGrades() {
        console.log('加载成绩...');
        const response = await callAPI('/student/grades');
        console.log('成绩响应:', response);

        if (!response.success) {
            this.showError('获取成绩失败');
            return;
        }

        // 处理不同格式的响应
        let grades = [];
        let statistics = {};

        if (response.data) {
            // 新格式：{success: true, data: {grades: [...], statistics: {...}}}
            if (response.data.grades) {
                grades = response.data.grades;
                statistics = response.data.statistics || {};
            }
            // 新格式：{success: true, data: [...]}
            else if (Array.isArray(response.data)) {
                grades = response.data;
            }
            // 嵌套格式：{success: true, data: {data: {grades: [...], statistics: {...}}}}
            else if (response.data.data) {
                if (response.data.data.grades) {
                    grades = response.data.data.grades;
                    statistics = response.data.data.statistics || {};
                } else if (Array.isArray(response.data.data)) {
                    grades = response.data.data;
                }
            }
        }

        this.grades = grades;
        const mainContent = document.getElementById('mainContent');

        let gradesHTML = '';
        if (grades.length === 0) {
            gradesHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-clipboard-check"></i> 暂无成绩信息
                    <p class="mb-0 mt-2">您还没有任何课程的成绩记录。</p>
                </div>
            `;
        } else {
            gradesHTML = `
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead class="table-light">
                            <tr>
                                <th>课程名称</th>
                                <th>课程号</th>
                                <th>学分</th>
                                <th>平时成绩</th>
                                <th>期末成绩</th>
                                <th>总成绩</th>
                                <th>状态</th>
                                <th>完整性验证</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${grades.map(grade => {
                const gradeLevel = this.getGradeLevel(grade.grade);
                const integrityVerified = grade.integrity_verified !== false;
                const integrityClass = integrityVerified ? 'bg-success' : 'bg-warning';
                const integrityText = integrityVerified ? '已验证 ✓' : '未验证 ⚠';

                return `
                                    <tr>
                                        <td>${grade.course_name || '未知课程'}</td>
                                        <td>${grade.course_id || '未知'}</td>
                                        <td>${grade.credits || '0'}</td>
                                        <td>${grade.regular_score !== null && grade.regular_score !== undefined ? grade.regular_score : '-'}</td>
                                        <td>${grade.final_score !== null && grade.final_score !== undefined ? grade.final_score : '-'}</td>
                                        <td>
                                            ${grade.grade !== null && grade.grade !== undefined ? `
                                                <span class="badge ${gradeLevel.class}">${grade.grade} (${gradeLevel.text})</span>
                                            ` : '-'}
                                        </td>
                                        <td>
                                            <span class="badge ${this.getStatusBadgeClass(grade.status)}">
                                                ${this.getStatusText(grade.status)}
                                            </span>
                                        </td>
                                        <td>
                                            <span class="badge ${integrityClass}" title="${grade.verification_message || ''}">
                                                ${integrityText}
                                            </span>
                                        </td>
                                    </tr>
                                `;
            }).join('')}
                        </tbody>
                    </table>
                </div>
                
                ${Object.keys(statistics).length > 0 ? this.renderGradeStatistics(statistics) : ''}
                
                <div class="alert alert-success mt-3">
                    <strong><i class="bi bi-shield-check"></i> 成绩完整性保护</strong>
                    <p class="mb-0 mt-2">系统使用SHA-256哈希算法保护您的成绩数据，确保成绩不被篡改。</p>
                </div>
            `;
        }

        mainContent.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4>成绩查询</h4>
                <div>
                    <button class="btn btn-outline-secondary ms-2" onclick="studentDashboard.loadGrades()">
                        <i class="bi bi-arrow-clockwise"></i> 刷新
                    </button>
                </div>
            </div>
            
            ${gradesHTML}
        `;
    }

    /**
     * 渲染成绩统计信息
     */
    renderGradeStatistics(statistics) {
        console.log('渲染成绩统计:', statistics);

        // 计算显示值 
        const coursesWithGrades = statistics.courses_with_grades || 0;
        const totalCredits = statistics.total_credits || 0;
        const gpa = parseFloat(statistics.gpa) || 0;
        const averageGrade = parseFloat(statistics.average_grade) || 0;

        return `
            <div class="card mt-4">
                <div class="card-header">
                    <h5 class="mb-0">成绩统计</h5>
                </div>
                <div class="card-body">
                    <div class="row text-center">
                        <div class="col-md-3 col-6 mb-3">
                            <div class="card bg-light">
                                <div class="card-body">
                                    <h2 class="display-6">${coursesWithGrades}</h2>
                                    <p class="text-muted mb-0">已有成绩课程</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3 col-6 mb-3">
                            <div class="card bg-light">
                                <div class="card-body">
                                    <h2 class="display-6">${totalCredits}</h2>
                                    <p class="text-muted mb-0">已获学分</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3 col-6 mb-3">
                            <div class="card bg-light">
                                <div class="card-body">
                                    <h2 class="display-6">${gpa.toFixed(2)}</h2>
                                    <p class="text-muted mb-0">平均绩点</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3 col-6 mb-3">
                            <div class="card bg-light">
                                <div class="card-body">
                                    <h2 class="display-6">${averageGrade.toFixed(2)}</h2>
                                    <p class="text-muted mb-0">平均成绩</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }


    // ==================== 核心业务功能 ====================

    /**
     * 学生选课
     */
    async enrollCourse(courseId, courseName) {
        if (!courseId || !courseName) {
            showMessage('课程信息不完整', 'warning');
            return;
        }

        if (!confirm(`确定要选择课程 "${courseName}" 吗？`)) {
            return;
        }

        console.log('开始选课:', courseId, courseName);
        showMessage('正在选课...', 'info');

        try {
            // 尝试新API端点
            let response = await callAPI(`/student/courses/${courseId}/enroll`, {
                method: 'POST'
            });

            // 如果新API端点不存在，尝试旧API端点
            if (!response.success && response.status === 404) {
                console.log('尝试旧API端点...');
                response = await callAPI('/student/courses/enroll', {
                    method: 'POST',
                    body: { course_id: courseId }
                });
            }

            console.log('选课响应:', response);

            if (response.success) {
                showMessage(`成功选择课程: ${courseName}`, 'success');

                // 刷新页面
                setTimeout(() => {
                    this.loadPage('enrollment');
                }, 1000);
            }
        } catch (error) {
            console.error('选课失败:', error);
            showMessage('选课失败，请稍后重试', 'danger');
        }
    }

    /**
     * 学生退选课程
     */
    async dropCourse(enrollmentId, courseName) {
        if (!enrollmentId || !courseName) {
            showMessage('选课记录信息不完整', 'warning');
            return;
        }

        if (!confirm(`确定要退选课程 "${courseName}" 吗？`)) {
            return;
        }

        console.log('开始退选:', enrollmentId, courseName);
        showMessage('正在退选...', 'info');

        try {
            // 尝试新API端点
            let response = await callAPI(`/student/enrollments/${enrollmentId}/drop`, {
                method: 'POST'
            });

            // 如果新API端点不存在，尝试旧API端点
            if (!response.success && response.status === 404) {
                console.log('尝试旧API端点...');
                response = await callAPI(`/student/courses/drop/${enrollmentId}`, {
                    method: 'POST'
                });
            }

            console.log('退选响应:', response);

            if (response.success) {
                showMessage(`成功退选课程: ${courseName}`, 'success');

                // 刷新页面
                setTimeout(() => {
                    this.loadEnrolledCourses();
                }, 1000);
            }
        } catch (error) {
            console.error('退选失败:', error);
            showMessage('退选失败，请稍后重试', 'danger');
        }
    }

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
     * 隐藏敏感信息（身份证、手机号）
     */
    maskSensitiveInfo(info, type = 'id') {
        if (!info) return '已加密';

        const str = String(info);
        if (type === 'id' && str.length >= 18) {
            // 身份证号：显示前6位和后4位，中间用*代替
            return str.substring(0, 6) + '********' + str.substring(str.length - 4);
        } else if (type === 'phone' && str.length >= 11) {
            // 手机号：显示前3位和后4位，中间用*代替
            return str.substring(0, 3) + '****' + str.substring(str.length - 4);
        } else if (str.length > 4) {
            // 其他信息：显示后4位
            return '****' + str.substring(str.length - 4);
        }

        return '****';
    }

    /**
     * 获取状态对应的徽章类
     */
    getStatusBadgeClass(status) {
        if (!status) return 'bg-light text-dark';

        switch (status) {
            case 'enrolled':
            case 'active':
                return 'bg-success';
            case 'dropped':
                return 'bg-warning';
            case 'completed':
                return 'bg-info';
            case 'leave':
                return 'bg-secondary';
            case 'graduated':
                return 'bg-dark';
            default:
                return 'bg-light text-dark';
        }
    }

    /**
     * 获取状态对应的文本
     */
    getStatusText(status) {
        if (!status) return '未知';

        const statusMap = {
            'enrolled': '已选',
            'active': '活跃',
            'dropped': '已退',
            'completed': '已完成',
            'leave': '休学',
            'graduated': '已毕业'
        };
        return statusMap[status] || status;
    }

    /**
     * 获取成绩等级
     */
    getGradeLevel(grade) {
        if (grade === null || grade === undefined) {
            return { class: 'bg-light text-dark', text: '无成绩' };
        }

        const numGrade = parseFloat(grade);
        if (isNaN(numGrade)) {
            return { class: 'bg-light text-dark', text: '无效成绩' };
        }

        if (numGrade >= 90) return { class: 'bg-success', text: '优秀' };
        if (numGrade >= 80) return { class: 'bg-info', text: '良好' };
        if (numGrade >= 70) return { class: 'bg-primary', text: '中等' };
        if (numGrade >= 60) return { class: 'bg-warning', text: '及格' };
        return { class: 'bg-danger', text: '不及格' };
    }

    /**
     * 截断文本
     */
    truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
}

// ==================== 全局实例和初始化 ====================

// 创建全局实例
let studentDashboard;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM加载完成，开始初始化学生仪表板...');

    // 检查是否在学生仪表板页面
    const isStudentPage = document.getElementById('studentName') !== null;

    if (isStudentPage) {
        studentDashboard = new StudentDashboard();

        // 将实例附加到window对象，方便在HTML中调用
        window.studentDashboard = studentDashboard;

        // 延迟初始化，确保所有资源加载完成
        setTimeout(() => {
            studentDashboard.init();
        }, 100);
    }
});

// ==================== 兼容性函数 ====================

// 如果common.js中的某些函数不存在，提供默认实现
if (typeof window.isValidEmail !== 'function') {
    window.isValidEmail = function (email) {
        if (!email) return false;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };
}

if (typeof window.isValidPhone !== 'function') {
    window.isValidPhone = function (phone) {
        if (!phone) return false;
        const phoneRegex = /^1[3-9]\d{9}$/;
        return phoneRegex.test(phone);
    };
}

console.log('student.js 加载完成 - 修复版');