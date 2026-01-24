// student.js - 学生功能函数
const API_BASE = 'http://localhost:5000';

// 加载个人资料
async function loadProfile() {
    try {
        const response = await fetch(`${API_BASE}/student/profile`);
        const data = await response.json();

        if (response.ok) {
            let html = '<h3>个人资料</h3><table class="table"><tbody>';
            for (const [key, value] of Object.entries(data)) {
                html += `<tr><th>${key}</th><td>${value || '未设置'}</td></tr>`;
            }
            html += '</tbody></table>';
            document.getElementById('content').innerHTML = html;
        } else {
            alert('获取个人资料失败: ' + data.error);
        }
    } catch (error) {
        console.error('加载个人资料失败:', error);
    }
}

// 加载可选课程
async function loadAvailableCourses() {
    try {
        const response = await fetch(`${API_BASE}/student/courses/available`);
        const courses = await response.json();

        let html = '<h3>可选课程</h3>';
        if (courses.length === 0) {
            html += '<p class="text-muted">当前无可选课程</p>';
        } else {
            html += '<table class="table table-hover"><thead><tr><th>课程号</th><th>课程名</th><th>学分</th><th>教师</th><th>容量</th><th>操作</th></tr></thead><tbody>';
            courses.forEach(course => {
                html += `<tr>
                    <td>${course.course_id}</td>
                    <td>${course.course_name}</td>
                    <td>${course.credits}</td>
                    <td>${course.teacher}</td>
                    <td>${course.current_enrollment}/${course.capacity}</td>
                    <td><button class="btn btn-sm btn-success" onclick="enrollCourse('${course.course_id}')">选课</button></td>
                </tr>`;
            });
            html += '</tbody></table>';
        }
        document.getElementById('content').innerHTML = html;
    } catch (error) {
        console.error('加载可选课程失败:', error);
    }
}

// 选课
async function enrollCourse(courseId) {
    if (!confirm('确定要选择这门课程吗？')) return;

    try {
        const response = await fetch(`${API_BASE}/student/courses/enroll`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ course_id: courseId })
        });

        const data = await response.json();
        if (response.ok) {
            alert('选课成功！');
            loadAvailableCourses();
        } else {
            alert('选课失败: ' + data.error);
        }
    } catch (error) {
        console.error('选课请求失败:', error);
    }
}

// 加载已选课程
async function loadEnrolledCourses() {
    try {
        const response = await fetch(`${API_BASE}/student/courses/enrolled`);
        const courses = await response.json();

        let html = '<h3>已选课程</h3>';
        if (courses.length === 0) {
            html += '<p class="text-muted">当前未选择任何课程</p>';
        } else {
            html += '<table class="table table-hover"><thead><tr><th>课程号</th><th>课程名</th><th>学分</th><th>教师</th><th>选课时间</th><th>状态</th><th>操作</th></tr></thead><tbody>';
            courses.forEach(course => {
                html += `<tr>
                    <td>${course.course_id}</td>
                    <td>${course.course_name}</td>
                    <td>${course.credits}</td>
                    <td>${course.teacher}</td>
                    <td>${course.enroll_time}</td>
                    <td>${course.status}</td>
                    <td>${course.status === 'enrolled' ?
                        `<button class="btn btn-sm btn-danger" onclick="dropCourse(${course.enrollment_id})">退选</button>` :
                        '<span class="text-muted">不可退选</span>'}</td>
                </tr>`;
            });
            html += '</tbody></table>';
        }
        document.getElementById('content').innerHTML = html;
    } catch (error) {
        console.error('加载已选课程失败:', error);
    }
}

// 退选课程
async function dropCourse(enrollmentId) {
    if (!confirm('确定要退选这门课程吗？')) return;

    try {
        const response = await fetch(`${API_BASE}/student/courses/drop/${enrollmentId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        const data = await response.json();
        if (response.ok) {
            alert('退选成功！');
            loadEnrolledCourses();
        } else {
            alert('退选失败: ' + data.error);
        }
    } catch (error) {
        console.error('退选请求失败:', error);
    }
}

// 加载成绩
async function loadGrades() {
    try {
        const response = await fetch(`${API_BASE}/student/grades`);
        const grades = await response.json();

        let html = '<h3>成绩查询</h3>';
        if (grades.length === 0) {
            html += '<p class="text-muted">暂无成绩信息</p>';
        } else {
            html += '<table class="table table-hover"><thead><tr><th>课程号</th><th>课程名</th><th>学分</th><th>平时成绩</th><th>期末成绩</th><th>总成绩</th><th>状态</th><th>完整性验证</th></tr></thead><tbody>';
            grades.forEach(grade => {
                const integrityClass = grade.integrity_verified ? 'text-success' : 'text-danger';
                html += `<tr>
                    <td>${grade.course_id}</td>
                    <td>${grade.course_name}</td>
                    <td>${grade.credits}</td>
                    <td>${grade.regular_score || '-'}</td>
                    <td>${grade.final_score || '-'}</td>
                    <td>${grade.grade || '-'}</td>
                    <td>${grade.status}</td>
                    <td class="${integrityClass}">${grade.verification_message}</td>
                </tr>`;
            });
            html += '</tbody></table>';
        }
        document.getElementById('content').innerHTML = html;
    } catch (error) {
        console.error('加载成绩失败:', error);
    }
}