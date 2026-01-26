// frontend/js/teacher.js - 教师端功能模块
// 使用common.js中的函数：showMessage, callAPI, formatDate等

// ==================== 教师模块主类 ====================
class TeacherDashboard {
    constructor() {
        this.currentUser = null;
        this.currentPage = 'dashboard';
        this.courses = [];
        this.students = [];
        this.grades = [];

        console.log('TeacherDashboard 初始化...');
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
     * 初始化教师仪表板
     */
    async init() {
        try {
            console.log('开始初始化教师仪表板...');

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

            console.log('TeacherDashboard 初始化完成');

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
        if (!user || user.role !== 'teacher') {
            showMessage('请先登录教师账户', 'warning');
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
            throw new Error('未登录或非教师账户');
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
        const teacherNameElement = document.getElementById('teacherName');
        if (teacherNameElement && this.currentUser) {
            teacherNameElement.textContent = this.currentUser.name || this.currentUser.username || '教师';
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
                case 'courses':
                    await this.loadCourses();
                    break;
                case 'students':
                    await this.loadStudents();
                    break;
                case 'grades':
                    await this.loadGrades();
                    break;
                case 'profile':
                    await this.loadProfile();
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
                <button class="btn btn-primary" onclick="teacherDashboard.loadPage('dashboard')">
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
            // 获取教师课程和单独获取学生列表（去重）
            const [coursesResponse, studentsResponse] = await Promise.all([
                callAPI('/teacher/courses'),
                callAPI('/teacher/students')
            ]);

            console.log('课程响应:', coursesResponse);
            console.log('学生响应:', studentsResponse);

            // 处理课程数据
            let coursesData = [];
            if (coursesResponse.success) {
                coursesData = this.extractData(coursesResponse);
                if (!Array.isArray(coursesData)) {
                    coursesData = [];
                }
            }

            // 处理学生数据（去重）
            let uniqueStudentCount = 0;
            let studentsData = [];
            if (studentsResponse.success) {
                studentsData = this.extractData(studentsResponse);
                if (Array.isArray(studentsData)) {
                    // 使用Set去重
                    const uniqueStudentIds = new Set();
                    studentsData.forEach(student => {
                        if (student.student_id) {
                            uniqueStudentIds.add(student.student_id);
                        }
                    });
                    uniqueStudentCount = uniqueStudentIds.size;
                }
            }

            // 计算总容量
            const totalCapacity = this.calculateTotalCapacity(coursesData);

            console.log('统计结果:', {
                courseCount: coursesData.length,
                uniqueStudentCount,
                totalCapacity
            });

            mainContent.innerHTML = `
            <h4 class="mb-4">教师仪表板</h4>
            
            <div class="alert alert-info">
                <strong>欢迎回来，${this.currentUser.name || this.currentUser.username}老师！</strong>
                <p class="mb-0 mt-2">请使用侧边栏菜单管理您的教学工作。</p>
            </div>
            
            <div class="row mt-4">
                <div class="col-md-6 mb-4">
                    <div class="card h-100">
                        <div class="card-header bg-primary text-white">
                            <h5 class="mb-0">教学统计</h5>
                        </div>
                        <div class="card-body">
                            <div class="text-center">
                                <h2 class="display-4">${coursesData.length}</h2>
                                <p class="text-muted mb-0">负责课程</p>
                            </div>
                            <hr>
                            <div class="row text-center">
                                <div class="col-6">
                                    <h5>${uniqueStudentCount}</h5>
                                    <small class="text-muted">总学生数</small>
                                </div>
                                <div class="col-6">
                                    <h5>${totalCapacity}</h5>
                                    <small class="text-muted">总容量</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-6 mb-4">
                    <div class="card h-100">
                        <div class="card-header bg-success text-white">
                            <h5 class="mb-0">快速操作</h5>
                        </div>
                        <div class="card-body">
                            <div class="d-grid gap-2">
                                <button class="btn btn-outline-primary" data-page="courses">
                                    <i class="bi bi-book"></i> 查看我的课程
                                </button>
                                <button class="btn btn-outline-success" data-page="grades">
                                    <i class="bi bi-clipboard-data"></i> 管理学生成绩
                                </button>
                                <button class="btn btn-outline-info" data-page="students">
                                    <i class="bi bi-people"></i> 查看学生列表
                                </button>
                                <button class="btn btn-outline-warning" data-page="profile">
                                    <i class="bi bi-person"></i> 个人信息设置
                                </button>
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
                        <p class="mb-0">请各位老师在规定时间内录入学生成绩，确保成绩数据的准确性。</p>
                    </div>
                    <div class="alert alert-light border mt-2">
                        <p class="mb-1"><strong>🔒 安全提醒</strong></p>
                        <p class="mb-0">系统使用SHA-256哈希算法保护成绩数据，确保成绩不被篡改。</p>
                    </div>
                </div>
            </div>
            
            <div class="row mt-4">
                <div class="col-md-12">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0">近期任务</h5>
                        </div>
                        <div class="card-body">
                            <ul class="list-group list-group-flush">
                                <li class="list-group-item">
                                    <i class="bi bi-check-circle text-success me-2"></i>
                                    完成CS101课程成绩录入
                                </li>
                                <li class="list-group-item">
                                    <i class="bi bi-clock text-warning me-2"></i>
                                    准备数据库原理课程资料
                                </li>
                                <li class="list-group-item">
                                    <i class="bi bi-calendar text-primary me-2"></i>
                                    安排下周实验课时间
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        `;

            // 为快速操作按钮添加点击事件
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

    /**
     * 计算总容量
     */
    calculateTotalCapacity(courses) {
        if (!Array.isArray(courses)) return 0;
        return courses.reduce((total, course) => total + (course.capacity || 0), 0);
    }
    /**
     * 计算总学生数（去重）
     */
    calculateUniqueStudents(students) {
        if (!Array.isArray(students)) return 0;

        const uniqueStudentIds = new Set();
        students.forEach(student => {
            if (student.student_id) {
                uniqueStudentIds.add(student.student_id);
            }
        });

        return uniqueStudentIds.size;
    }
    // ==================== 我的课程页面 ====================

    /**
     * 加载我的课程页面
     */
    async loadCourses() {
        console.log('加载我的课程...');
        const response = await callAPI('/teacher/courses');

        if (!response.success) {
            this.showError('获取课程列表失败');
            return;
        }

        this.courses = this.extractData(response) || [];
        const mainContent = document.getElementById('mainContent');

        let coursesHTML = '';
        if (this.courses.length === 0) {
            coursesHTML = `
                <div class="alert alert-warning">
                    <i class="bi bi-book"></i> 当前没有负责的课程
                    <p class="mb-0 mt-2">请联系管理员分配教学任务。</p>
                </div>
            `;
        } else {
            coursesHTML = `
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead class="table-light">
                            <tr>
                                <th>课程号</th>
                                <th>课程名称</th>
                                <th>学分</th>
                                <th>学时</th>
                                <th>学期</th>
                                <th>类型</th>
                                <th>学生人数</th>
                                <th>上课时间</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.courses.map(course => `
                                <tr>
                                    <td>${course.course_id || '未知'}</td>
                                    <td>
                                        <strong>${course.course_name || '未知课程'}</strong>
                                        ${course.description ? `<br><small class="text-muted">${this.truncateText(course.description, 50)}</small>` : ''}
                                    </td>
                                    <td>${course.credits || '0'}</td>
                                    <td>${course.hours || '0'}</td>
                                    <td>${course.semester || '未知'}</td>
                                    <td>
                                        <span class="badge ${this.getCourseTypeClass(course.type)}">
                                            ${this.getCourseTypeText(course.type)}
                                        </span>
                                    </td>
                                    <td>
                                        <span class="badge ${course.current_enrollment < course.capacity ? 'bg-success' : 'bg-danger'}">
                                            ${course.current_enrollment || 0} / ${course.capacity || 0}
                                        </span>
                                    </td>
                                    <td>
                                        ${course.teaching_time || '未安排'}
                                        <br>
                                        <small class="text-muted">${course.location || '未安排地点'}</small>
                                    </td>
                                    <td>
                                        <button class="btn btn-sm btn-outline-primary me-1" onclick="teacherDashboard.viewCourseStudents('${course.course_id}', '${this.escapeString(course.course_name)}')">
                                            查看学生
                                        </button>
                                        <button class="btn btn-sm btn-outline-info" onclick="teacherDashboard.viewCourseGrades('${course.course_id}', '${this.escapeString(course.course_name)}')">
                                            成绩管理
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div class="alert alert-info mt-3">
                    <i class="bi bi-info-circle"></i> 共 ${this.courses.length} 门课程
                </div>
            `;
        }

        mainContent.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4>我的课程</h4>
                <div>
                    <button class="btn btn-outline-primary" onclick="teacherDashboard.loadCourses()">
                        <i class="bi bi-arrow-clockwise"></i> 刷新
                    </button>
                </div>
            </div>
            
            ${coursesHTML}
        `;
    }

    // ==================== 学生管理页面 ====================

    /**
     * 加载学生管理页面
     */
    async loadStudents() {
        console.log('加载学生管理...');
        const response = await callAPI('/teacher/students');

        if (!response.success) {
            this.showError('获取学生列表失败');
            return;
        }

        this.students = this.extractData(response) || [];
        const mainContent = document.getElementById('mainContent');

        let studentsHTML = '';
        if (this.students.length === 0) {
            studentsHTML = `
                <div class="alert alert-warning">
                    <i class="bi bi-people"></i> 当前没有学生数据
                    <p class="mb-0 mt-2">您还没有被分配教学任务，或者所教课程没有学生选课。</p>
                </div>
            `;
        } else {
            studentsHTML = `
                <div class="mb-4">
                    <div class="input-group">
                        <input type="text" class="form-control" placeholder="搜索学生（姓名、学号、课程）..." 
                               id="studentSearch" onkeyup="teacherDashboard.searchStudents()">
                        <button class="btn btn-outline-secondary" type="button" onclick="teacherDashboard.searchStudents()">
                            <i class="bi bi-search"></i> 搜索
                        </button>
                    </div>
                </div>
                
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead class="table-light">
                            <tr>
                                <th>学号</th>
                                <th>姓名</th>
                                <th>性别</th>
                                <th>院系</th>
                                <th>专业</th>
                                <th>课程</th>
                                <th>教学班号</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody id="studentTableBody">
                            ${this.renderStudentRows(this.students)}
                        </tbody>
                    </table>
                </div>
                
                <div class="alert alert-info mt-3">
                    <i class="bi bi-info-circle"></i> 共 ${this.students.length} 名学生
                </div>
            `;
        }

        mainContent.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4>学生管理</h4>
                <div>
                    <button class="btn btn-outline-primary" onclick="teacherDashboard.loadStudents()">
                        <i class="bi bi-arrow-clockwise"></i> 刷新
                    </button>
                </div>
            </div>
            
            ${studentsHTML}
        `;

        // 保存原始学生数据用于搜索
        this.originalStudents = [...this.students];
    }

    /**
     * 渲染学生表格行
     */
    renderStudentRows(students) {
        if (!Array.isArray(students)) return '';

        return students.map(student => `
            <tr>
                <td>${student.student_id || '未知'}</td>
                <td>${student.name || '未知'}</td>
                <td>${student.gender || '未知'}</td>
                <td>${student.department || '未设置'}</td>
                <td>${student.major || '未设置'}</td>
                <td>${student.course_name || '未知课程'}</td>
                <td>${student.class_no || '未设置'}</td>
                <td>
                    <button class="btn btn-sm btn-outline-info" onclick="teacherDashboard.viewStudentGrades('${student.student_id}', '${this.escapeString(student.name)}')">
                        查看成绩
                    </button>
                </td>
            </tr>
        `).join('');
    }

    /**
     * 搜索学生
     */
    searchStudents() {
        const searchTerm = document.getElementById('studentSearch').value.toLowerCase().trim();
        const tableBody = document.getElementById('studentTableBody');

        if (!searchTerm) {
            // 显示所有学生
            tableBody.innerHTML = this.renderStudentRows(this.originalStudents);
            return;
        }

        const filteredStudents = this.originalStudents.filter(student => {
            return (
                (student.student_id && student.student_id.toLowerCase().includes(searchTerm)) ||
                (student.name && student.name.toLowerCase().includes(searchTerm)) ||
                (student.department && student.department.toLowerCase().includes(searchTerm)) ||
                (student.major && student.major.toLowerCase().includes(searchTerm)) ||
                (student.course_name && student.course_name.toLowerCase().includes(searchTerm)) ||
                (student.class_no && student.class_no.toLowerCase().includes(searchTerm))
            );
        });

        tableBody.innerHTML = this.renderStudentRows(filteredStudents);
    }

    // ==================== 成绩管理页面 ====================

    /**
     * 加载成绩管理页面
     */
    async loadGrades() {
        console.log('加载成绩管理...');
        const response = await callAPI('/teacher/grades');

        if (!response.success) {
            this.showError('获取成绩数据失败');
            return;
        }

        this.grades = this.extractData(response) || [];
        const mainContent = document.getElementById('mainContent');

        let gradesHTML = '';
        if (this.grades.length === 0) {
            gradesHTML = `
                <div class="alert alert-warning">
                    <i class="bi bi-clipboard-data"></i> 暂无成绩数据
                    <p class="mb-0 mt-2">请先查看您的课程和学生列表。</p>
                </div>
            `;
        } else {
            gradesHTML = `
                <div class="alert alert-info mb-4">
                    <strong><i class="bi bi-lightbulb"></i> 使用说明</strong>
                    <p class="mb-0 mt-2">请输入0-100之间的分数，系统会自动计算总成绩（平时50% + 期末50%）。修改后点击"保存"按钮。</p>
                </div>
                
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead class="table-light">
                            <tr>
                                <th>学号</th>
                                <th>姓名</th>
                                <th>课程</th>
                                <th>平时成绩</th>
                                <th>期末成绩</th>
                                <th>总成绩</th>
                                <th>状态</th>
                                <th>完整性验证</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.grades.map(grade => {
                const integrityVerified = grade.integrity_verified !== false;
                const integrityClass = integrityVerified ? 'bg-success' : 'bg-warning';
                const integrityText = integrityVerified ? '已验证' : '未验证';

                return `
                                    <tr>
                                        <td>${grade.student_id || '未知'}</td>
                                        <td>${grade.student_name || '未知'}</td>
                                        <td>${grade.course_name || '未知课程'}</td>
                                        <td>
                                            <input type="number" class="form-control form-control-sm grade-input" 
                                                   value="${grade.regular_score !== null && grade.regular_score !== undefined ? grade.regular_score : ''}" 
                                                   min="0" max="100" step="0.1"
                                                   data-student="${grade.student_id}" 
                                                   data-course="${grade.course_id}"
                                                   data-type="regular">
                                        </td>
                                        <td>
                                            <input type="number" class="form-control form-control-sm grade-input" 
                                                   value="${grade.final_score !== null && grade.final_score !== undefined ? grade.final_score : ''}" 
                                                   min="0" max="100" step="0.1"
                                                   data-student="${grade.student_id}" 
                                                   data-course="${grade.course_id}"
                                                   data-type="final">
                                        </td>
                                        <td>
                                            ${grade.grade !== null && grade.grade !== undefined ? `
                                                <span class="badge ${this.getGradeBadgeClass(grade.grade)}">
                                                    ${grade.grade.toFixed(2)}
                                                </span>
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
                                        <td>
                                            <button class="btn btn-sm btn-outline-success" onclick="teacherDashboard.saveGrade('${grade.student_id}', '${grade.course_id}')">
                                                保存
                                            </button>
                                        </td>
                                    </tr>
                                `;
            }).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div class="mt-4">
                    <button class="btn btn-primary" onclick="teacherDashboard.saveAllGrades()">
                        <i class="bi bi-save"></i> 保存所有更改
                    </button>
                    <button class="btn btn-secondary ms-2" onclick="teacherDashboard.loadGrades()">
                        取消
                    </button>
                </div>
                
                <div class="alert alert-success mt-4">
                    <strong><i class="bi bi-shield-check"></i> 成绩完整性保护</strong>
                    <p class="mb-0 mt-2">系统使用SHA-256哈希算法保护成绩数据，确保成绩不被篡改。每次成绩更新都会重新计算哈希值。</p>
                </div>
            `;
        }

        mainContent.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4>成绩管理</h4>
                <div>
                    <button class="btn btn-outline-primary" onclick="teacherDashboard.loadGrades()">
                        <i class="bi bi-arrow-clockwise"></i> 刷新
                    </button>
                </div>
            </div>
            
            ${gradesHTML}
        `;
    }

    // ==================== 个人资料页面 ====================

    /**
     * 加载个人资料页面
     */
    async loadProfile() {
        console.log('加载个人资料...');
        const response = await callAPI('/teacher/profile');

        if (!response.success) {
            this.showError('获取教师信息失败');
            return;
        }

        const teacher = this.extractData(response) || {};
        const mainContent = document.getElementById('mainContent');

        mainContent.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4>个人中心</h4>
                <div>
                    <button class="btn btn-primary" id="editProfileBtn">
                        <i class="bi bi-pencil"></i> 编辑资料
                    </button>
                    <!-- 新增：修改密码按钮 -->
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
                                <label class="form-label text-muted">工号</label>
                                <p class="fs-5">${teacher.teacher_id || '未设置'}</p>
                            </div>
                            <div class="mb-3">
                                <label class="form-label text-muted">姓名</label>
                                <p class="fs-5">${teacher.name || '未设置'}</p>
                            </div>
                            <div class="mb-3">
                                <label class="form-label text-muted">性别</label>
                                <p class="fs-5">${teacher.gender || '未设置'}</p>
                            </div>
                            <div class="mb-3">
                                <label class="form-label text-muted">职称</label>
                                <p class="fs-5">${teacher.title || '未设置'}</p>
                            </div>
                        </div>
                        
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label class="form-label text-muted">院系</label>
                                <p class="fs-5">${teacher.department || '未设置'}</p>
                            </div>
                            <div class="mb-3">
                                <label class="form-label text-muted">办公室</label>
                                <p class="fs-5">${teacher.office || '未设置'}</p>
                            </div>
                            <div class="mb-3">
                                <label class="form-label text-muted">联系电话</label>
                                <p class="fs-5">${teacher.phone || '未设置'}</p>
                            </div>
                            <div class="mb-3">
                                <label class="form-label text-muted">邮箱</label>
                                <p class="fs-5">${teacher.email || '未设置'}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="row">
                        <div class="col-md-12">
                            <div class="mb-3">
                                <label class="form-label text-muted">创建时间</label>
                                <p class="fs-5">${teacher.created_at ? formatDate(teacher.created_at) : '未知'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 绑定编辑按钮事件
        document.getElementById('editProfileBtn').addEventListener('click', () => {
            this.editProfile(teacher);
        });
        // 绑定修改密码按钮事件
        document.getElementById('changePasswordBtn').addEventListener('click', () => {
            this.showChangePasswordModal();
        });
    }

        /**
     * 新增：显示修改密码模态框
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
                            <button type="button" class="btn btn-primary" onclick="teacherDashboard.submitChangePassword()">提交修改</button>
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
        
        // 前端二次校验（与学生端一致）
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
        
        // 提交状态处理（与学生端一致）
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


    /**
     * 编辑个人资料
     */
    async editProfile(teacher) {
        console.log('编辑个人资料...');
        const mainContent = document.getElementById('mainContent');

        mainContent.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4>编辑个人资料</h4>
                <button class="btn btn-secondary" onclick="teacherDashboard.loadPage('profile')">
                    <i class="bi bi-arrow-left"></i> 返回
                </button>
            </div>
            
            <div class="card">
                <div class="card-body">
                    <form id="editProfileForm">
                        <div class="row">
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <label class="form-label">工号</label>
                                    <input type="text" class="form-control" value="${teacher.teacher_id || ''}" disabled>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">姓名</label>
                                    <input type="text" class="form-control" id="name" value="${teacher.name || ''}" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">职称</label>
                                    <input type="text" class="form-control" id="title" value="${teacher.title || ''}">
                                </div>
                            </div>
                            
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <label class="form-label">院系</label>
                                    <input type="text" class="form-control" id="department" value="${teacher.department || ''}">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">办公室</label>
                                    <input type="text" class="form-control" id="office" value="${teacher.office || ''}">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">邮箱</label>
                                    <input type="email" class="form-control" id="email" value="${teacher.email || ''}">
                                </div>
                            </div>
                        </div>
                        
                        <div class="alert alert-warning mt-3">
                            <strong><i class="bi bi-exclamation-triangle"></i> 提示</strong>
                            <p class="mb-0">工号、性别等核心信息不可在此修改，如需修改请联系管理员。</p>
                        </div>
                        
                        <div class="mt-4">
                            <button type="submit" class="btn btn-primary">
                                <i class="bi bi-check-circle"></i> 保存更改
                            </button>
                            <button type="button" class="btn btn-secondary" onclick="teacherDashboard.loadPage('profile')">
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

            const name = document.getElementById('name').value.trim();
            const title = document.getElementById('title').value.trim();
            const department = document.getElementById('department').value.trim();
            const office = document.getElementById('office').value.trim();
            const email = document.getElementById('email').value.trim();

            // 验证邮箱格式
            if (email && !isValidEmail(email)) {
                showMessage('邮箱格式不正确', 'warning');
                return;
            }

            // 显示加载状态
            const submitBtn = document.querySelector('#editProfileForm button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> 保存中...';
            submitBtn.disabled = true;

            try {
                const response = await callAPI('/teacher/update-profile', {
                    method: 'POST',
                    body: { name, title, department, office, email }
                });

                console.log('更新个人资料响应:', response);

                if (response.success) {
                    showMessage('个人信息更新成功！', 'success');
                    setTimeout(() => this.loadPage('profile'), 1000);
                } else {
                    showMessage(response.error || '更新失败', 'danger');
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

    // ==================== 核心业务功能 ====================

    /**
     * 查看课程学生
     */
    viewCourseStudents(courseId, courseName) {
        showMessage(`正在加载 ${courseName} 的学生列表...`, 'info');
        // 这里可以跳转到学生管理页面并筛选该课程的学生
        // 由于API没有专门的课程学生筛选，我们暂时加载学生管理页面
        this.loadPage('students');
    }

    /**
     * 查看课程成绩
     */
    viewCourseGrades(courseId, courseName) {
        showMessage(`正在加载 ${courseName} 的成绩...`, 'info');
        this.loadPage('grades');
    }

    /**
     * 查看学生成绩
     */
    viewStudentGrades(studentId, studentName) {
        showMessage(`正在加载 ${studentName} 的成绩...`, 'info');
        this.loadPage('grades');
    }

    /**
     * 保存单个成绩
     */
    async saveGrade(studentId, courseId) {
        // 获取输入框的值
        const regularInput = document.querySelector(`input[data-student="${studentId}"][data-course="${courseId}"][data-type="regular"]`);
        const finalInput = document.querySelector(`input[data-student="${studentId}"][data-course="${courseId}"][data-type="final"]`);

        const regularScore = regularInput ? regularInput.value : null;
        const finalScore = finalInput ? finalInput.value : null;

        if ((regularScore && (regularScore < 0 || regularScore > 100)) ||
            (finalScore && (finalScore < 0 || finalScore > 100))) {
            showMessage('请输入0-100之间的有效分数', 'warning');
            return;
        }

        // 显示加载状态
        const saveBtn = document.querySelector(`button[onclick="teacherDashboard.saveGrade('${studentId}', '${courseId}')"]`);
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> 保存中...';
        saveBtn.disabled = true;

        try {
            const response = await callAPI('/teacher/grades/update', {
                method: 'POST',
                body: {
                    student_id: studentId,
                    course_id: courseId,
                    regular_score: regularScore,
                    final_score: finalScore
                }
            });

            console.log('保存成绩响应:', response);

            if (response.success) {
                showMessage('成绩保存成功', 'success');
                // 刷新页面以显示新计算的总成绩
                setTimeout(() => this.loadPage('grades'), 1000);
            } else {
                showMessage(response.error || '保存失败', 'danger');
            }
        } catch (error) {
            console.error('保存成绩失败:', error);
            showMessage('保存失败，请稍后重试', 'danger');
        } finally {
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }
    }

    /**
     * 保存所有成绩
     */
    async saveAllGrades() {
        if (!confirm('确定要保存所有成绩更改吗？')) return;

        const gradeInputs = document.querySelectorAll('.grade-input');
        const updates = [];

        // 验证所有输入
        for (const input of gradeInputs) {
            const value = input.value.trim();
            if (value && (parseFloat(value) < 0 || parseFloat(value) > 100)) {
                showMessage('所有分数必须在0-100之间', 'warning');
                return;
            }
        }

        // 收集更新数据
        const updateMap = new Map();

        gradeInputs.forEach(input => {
            const studentId = input.dataset.student;
            const courseId = input.dataset.course;
            const type = input.dataset.type;
            const value = input.value;

            const key = `${studentId}-${courseId}`;
            if (!updateMap.has(key)) {
                updateMap.set(key, {
                    student_id: studentId,
                    course_id: courseId
                });
            }

            const update = updateMap.get(key);
            update[`${type}_score`] = value ? parseFloat(value) : null;
        });

        updates.push(...updateMap.values());

        if (updates.length === 0) {
            showMessage('没有需要保存的更改', 'info');
            return;
        }

        // 显示加载状态
        const saveBtn = document.querySelector('button[onclick="teacherDashboard.saveAllGrades()"]');
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> 批量保存中...';
        saveBtn.disabled = true;

        try {
            const response = await callAPI('/teacher/grades/batch-update', {
                method: 'POST',
                body: { updates }
            });

            console.log('批量保存成绩响应:', response);

            if (response.success) {
                showMessage(`成功保存 ${response.data?.successful_updates || 0} 条成绩记录`, 'success');
                // 刷新页面
                setTimeout(() => this.loadPage('grades'), 1000);
            } else {
                showMessage(response.error || '批量保存失败', 'danger');
            }
        } catch (error) {
            console.error('批量保存成绩失败:', error);
            showMessage('保存失败，请稍后重试', 'danger');
        } finally {
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
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
     * 获取课程类型对应的类
     */
    getCourseTypeClass(type) {
        if (!type) return 'bg-light text-dark';

        switch (type) {
            case 'compulsory':
                return 'bg-primary';
            case 'elective':
                return 'bg-success';
            case 'general':
                return 'bg-info';
            default:
                return 'bg-light text-dark';
        }
    }

    /**
     * 获取课程类型对应的文本
     */
    getCourseTypeText(type) {
        if (!type) return '未知';

        const typeMap = {
            'compulsory': '必修',
            'elective': '选修',
            'general': '通识'
        };
        return typeMap[type] || type;
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
     * 获取成绩对应的徽章类
     */
    getGradeBadgeClass(grade) {
        if (grade === null || grade === undefined) {
            return 'bg-light text-dark';
        }

        if (grade >= 90) return 'bg-success';
        if (grade >= 80) return 'bg-info';
        if (grade >= 70) return 'bg-primary';
        if (grade >= 60) return 'bg-warning';
        return 'bg-danger';
    }
}

// ==================== 全局实例和初始化 ====================

// 创建全局实例
let teacherDashboard;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM加载完成，开始初始化教师仪表板...');

    // 检查是否在教师仪表板页面
    const isTeacherPage = document.getElementById('teacherName') !== null;

    if (isTeacherPage) {
        teacherDashboard = new TeacherDashboard();

        // 将实例附加到window对象，方便在HTML中调用
        window.teacherDashboard = teacherDashboard;

        // 延迟初始化，确保所有资源加载完成
        setTimeout(() => {
            teacherDashboard.init();
        }, 100);
    }
});

console.log('teacher.js 加载完成');