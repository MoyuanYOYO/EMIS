"""
backend/routes/teacher.py - 教师管理API
"""
from flask import Blueprint, request, jsonify, session
from backend import models
from backend.app import db
from backend.utils.decorators import teacher_only, login_required
from backend.utils.security import SecurityUtils
import datetime

# 创建蓝图
teacher_bp = Blueprint('teacher', __name__)

# ==================== 教师个人信息API ====================

@teacher_bp.route('/profile', methods=['GET'])
@teacher_only
def profile():
    """获取教师个人资料"""
    user_id = session.get('user_id')
    
    teacher = models.Teacher.query.get(user_id)
    if not teacher:
        return jsonify({'error': '教师信息不存在'}), 404
    
    teacher_info = {
        'teacher_id': teacher.teacher_id,
        'name': teacher.name,
        'gender': teacher.gender,
        'title': teacher.title,
        'department': teacher.department,
        'office': teacher.office,
        'phone': teacher.phone,
        'email': teacher.email,
        'created_at': teacher.created_at.isoformat() if teacher.created_at else None,
        'updated_at': teacher.updated_at.isoformat() if teacher.updated_at else None
    }
    
    return jsonify(teacher_info)

@teacher_bp.route('/update-profile', methods=['POST'])
@teacher_only
def update_profile():
    """更新教师信息"""
    user_id = session.get('user_id')
    
    teacher = models.Teacher.query.get(user_id)
    if not teacher:
        return jsonify({'error': '教师信息不存在'}), 404
    
    data = request.get_json()
    
    # 允许更新的字段
    allowed_fields = ['name', 'email', 'department', 'title', 'office']
    
    updated = False
    for field in allowed_fields:
        if field in data:
            setattr(teacher, field, data[field])
            updated = True
    
    if updated:
        teacher.updated_at = datetime.datetime.now()
        db.session.commit()
        
        # 记录日志
        log = models.AuditLog(
            user_id=user_id,
            action_type='update_teacher_profile',
            description='教师更新个人信息',
            ip_address=request.remote_addr,
            result='success'
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({'success': True, 'message': '个人信息更新成功'})
    else:
        return jsonify({'error': '没有可更新的字段'}), 400

# ==================== 教师课程管理API ====================

@teacher_bp.route('/courses', methods=['GET'])
@teacher_only
def get_courses():
    """获取教师教授的课程"""
    teacher_id = session.get('user_id')
    
    # 获取教师的教学任务
    teachings = models.Teaching.query.filter_by(teacher_id=teacher_id).all()
    
    courses = []
    for teaching in teachings:
        course = models.Course.query.get(teaching.course_id)
        if course:
            courses.append({
                'course_id': course.course_id,
                'course_name': course.course_name,
                'credits': course.credits,
                'hours': course.hours,
                'type': course.type,
                'semester': course.semester,
                'capacity': course.capacity,
                'current_enrollment': course.current_enrollment,
                'class_no': teaching.class_no,
                'teaching_time': teaching.teaching_time,
                'location': teaching.location
            })
    
    return jsonify(courses)

@teacher_bp.route('/courses/<course_id>/students', methods=['GET'])
@teacher_only
def get_course_students(course_id):
    """获取指定课程的学生列表"""
    teacher_id = session.get('user_id')
    
    # 验证教师是否教授此课程
    teaching = models.Teaching.query.filter_by(
        teacher_id=teacher_id, 
        course_id=course_id
    ).first()
    
    if not teaching:
        return jsonify({'error': '您没有教授此课程的权限'}), 403
    
    # 获取选课学生
    enrollments = models.Enrollment.query.filter_by(
        course_id=course_id,
        status='enrolled'
    ).all()
    
    students = []
    for enrollment in enrollments:
        student = models.Student.query.get(enrollment.student_id)
        if student:
            students.append({
                'student_id': student.student_id,
                'name': student.name,
                'gender': student.gender,
                'department': student.department,
                'major': student.major,
                'enrollment_year': student.enrollment_year,
                'enrollment_id': enrollment.enrollment_id,
                'regular_score': enrollment.regular_score,
                'final_score': enrollment.final_score,
                'grade': enrollment.grade
            })
    
    return jsonify(students)

# ==================== 学生管理API ====================

@teacher_bp.route('/students', methods=['GET'])
@teacher_only
def get_students():
    """获取教师所有课程的学生"""
    teacher_id = session.get('user_id')
    
    # 获取教师的所有教学任务
    teachings = models.Teaching.query.filter_by(teacher_id=teacher_id).all()
    
    students = []
    student_ids = set()  # 用于去重
    
    for teaching in teachings:
        # 获取该课程的所有学生
        enrollments = models.Enrollment.query.filter_by(
            course_id=teaching.course_id,
            status='enrolled'
        ).all()
        
        course = models.Course.query.get(teaching.course_id)
        
        for enrollment in enrollments:
            if enrollment.student_id not in student_ids:
                student = models.Student.query.get(enrollment.student_id)
                if student:
                    students.append({
                        'student_id': student.student_id,
                        'name': student.name,
                        'department': student.department,
                        'course_id': teaching.course_id,
                        'course_name': course.course_name if course else '未知课程',
                        'class_no': teaching.class_no
                    })
                    student_ids.add(enrollment.student_id)
    
    return jsonify(students)

# ==================== 成绩管理API ====================

@teacher_bp.route('/grades', methods=['GET'])
@teacher_only
def get_grades():
    """获取教师所有课程的学生成绩"""
    teacher_id = session.get('user_id')
    
    # 获取教师的所有教学任务
    teachings = models.Teaching.query.filter_by(teacher_id=teacher_id).all()
    
    grades = []
    
    for teaching in teachings:
        # 获取该课程的所有学生成绩
        enrollments = models.Enrollment.query.filter_by(
            course_id=teaching.course_id
        ).all()
        
        course = models.Course.query.get(teaching.course_id)
        
        for enrollment in enrollments:
            student = models.Student.query.get(enrollment.student_id)
            if student and course:
                grade_hash_verified = True
                if enrollment.grade and enrollment.grade_hash:
                    grade_hash_verified = SecurityUtils.verify_grade_hash(
                        enrollment.student_id,
                        enrollment.course_id,
                        enrollment.grade,
                        enrollment.grade_hash
                    )
                
                grades.append({
                    'student_id': student.student_id,
                    'student_name': student.name,
                    'course_id': course.course_id,
                    'course_name': course.course_name,
                    'regular_score': enrollment.regular_score,
                    'final_score': enrollment.final_score,
                    'grade': enrollment.grade,
                    'status': enrollment.status,
                    'integrity_verified': grade_hash_verified,
                    'enrollment_id': enrollment.enrollment_id
                })
    
    return jsonify(grades)

@teacher_bp.route('/grades/update', methods=['POST'])
@teacher_only
def update_grade():
    """更新学生成绩"""
    teacher_id = session.get('user_id')
    
    data = request.get_json()
    student_id = data.get('student_id')
    course_id = data.get('course_id')
    regular_score = data.get('regular_score')
    final_score = data.get('final_score')
    
    if not student_id or not course_id:
        return jsonify({'error': '缺少必要参数'}), 400
    
    # 验证教师是否有权限修改此成绩
    teaching = models.Teaching.query.filter_by(
        teacher_id=teacher_id,
        course_id=course_id
    ).first()
    
    if not teaching:
        return jsonify({'error': '您没有权限修改此课程的成绩'}), 403
    
    # 获取选课记录
    enrollment = models.Enrollment.query.filter_by(
        student_id=student_id,
        course_id=course_id
    ).first()
    
    if not enrollment:
        return jsonify({'error': '选课记录不存在'}), 404
    
    # 验证分数范围
    if regular_score is not None:
        try:
            regular_score = float(regular_score)
            if regular_score < 0 or regular_score > 100:
                return jsonify({'error': '平时成绩必须在0-100之间'}), 400
            enrollment.regular_score = regular_score
        except ValueError:
            return jsonify({'error': '平时成绩格式错误'}), 400
    
    if final_score is not None:
        try:
            final_score = float(final_score)
            if final_score < 0 or final_score > 100:
                return jsonify({'error': '期末成绩必须在0-100之间'}), 400
            enrollment.final_score = final_score
        except ValueError:
            return jsonify({'error': '期末成绩格式错误'}), 400
    
    # 计算总成绩（平时占30%，期末占70%）
    if enrollment.regular_score is not None and enrollment.final_score is not None:
        enrollment.grade = round(enrollment.regular_score * 0.3 + enrollment.final_score * 0.7, 2)
        # 生成成绩哈希
        enrollment.grade_hash = SecurityUtils.calculate_grade_hash(
            enrollment.student_id,
            enrollment.course_id,
            enrollment.grade
        )
    elif enrollment.final_score is not None:
        enrollment.grade = enrollment.final_score
        enrollment.grade_hash = SecurityUtils.calculate_grade_hash(
            enrollment.student_id,
            enrollment.course_id,
            enrollment.grade
        )
    else:
        enrollment.grade = None
        enrollment.grade_hash = None
    
    enrollment.updated_at = datetime.datetime.now()
    db.session.commit()
    
    # 记录日志
    log = models.AuditLog(
        user_id=teacher_id,
        action_type='update_grade',
        description=f'教师 {teacher_id} 修改学生 {student_id} 在课程 {course_id} 的成绩',
        ip_address=request.remote_addr,
        result='success'
    )
    db.session.add(log)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': '成绩更新成功',
        'grade': enrollment.grade
    })

@teacher_bp.route('/grades/batch-update', methods=['POST'])
@teacher_only
def batch_update_grades():
    """批量更新成绩"""
    teacher_id = session.get('user_id')
    
    data = request.get_json()
    updates = data.get('updates', [])
    
    if not updates:
        return jsonify({'error': '没有需要更新的数据'}), 400
    
    successful_updates = 0
    failed_updates = []
    
    for update_data in updates:
        student_id = update_data.get('student_id')
        course_id = update_data.get('course_id')
        regular_score = update_data.get('regular_score')
        final_score = update_data.get('final_score')
        
        if not student_id or not course_id:
            continue
        
        # 验证教师是否有权限修改此成绩
        teaching = models.Teaching.query.filter_by(
            teacher_id=teacher_id,
            course_id=course_id
        ).first()
        
        if not teaching:
            failed_updates.append({
                'student_id': student_id,
                'course_id': course_id,
                'error': '没有权限'
            })
            continue
        
        # 获取选课记录
        enrollment = models.Enrollment.query.filter_by(
            student_id=student_id,
            course_id=course_id
        ).first()
        
        if not enrollment:
            failed_updates.append({
                'student_id': student_id,
                'course_id': course_id,
                'error': '选课记录不存在'
            })
            continue
        
        try:
            if regular_score is not None:
                regular_score = float(regular_score)
                if regular_score < 0 or regular_score > 100:
                    failed_updates.append({
                        'student_id': student_id,
                        'course_id': course_id,
                        'error': '平时成绩超出范围'
                    })
                    continue
                enrollment.regular_score = regular_score
            
            if final_score is not None:
                final_score = float(final_score)
                if final_score < 0 or final_score > 100:
                    failed_updates.append({
                        'student_id': student_id,
                        'course_id': course_id,
                        'error': '期末成绩超出范围'
                    })
                    continue
                enrollment.final_score = final_score
            
            # 计算总成绩
            if enrollment.regular_score is not None and enrollment.final_score is not None:
                enrollment.grade = round(enrollment.regular_score * 0.3 + enrollment.final_score * 0.7, 2)
                enrollment.grade_hash = SecurityUtils.calculate_grade_hash(
                    enrollment.student_id,
                    enrollment.course_id,
                    enrollment.grade
                )
            elif enrollment.final_score is not None:
                enrollment.grade = enrollment.final_score
                enrollment.grade_hash = SecurityUtils.calculate_grade_hash(
                    enrollment.student_id,
                    enrollment.course_id,
                    enrollment.grade
                )
            else:
                enrollment.grade = None
                enrollment.grade_hash = None
            
            enrollment.updated_at = datetime.datetime.now()
            successful_updates += 1
            
        except ValueError:
            failed_updates.append({
                'student_id': student_id,
                'course_id': course_id,
                'error': '成绩格式错误'
            })
    
    if successful_updates > 0:
        db.session.commit()
        
        # 记录日志
        log = models.AuditLog(
            user_id=teacher_id,
            action_type='batch_update_grades',
            description=f'教师 {teacher_id} 批量更新 {successful_updates} 条成绩记录',
            ip_address=request.remote_addr,
            result='success'
        )
        db.session.add(log)
        db.session.commit()
    
    return jsonify({
        'success': True,
        'message': f'成功更新 {successful_updates} 条记录，失败 {len(failed_updates)} 条',
        'successful_updates': successful_updates,
        'failed_updates': failed_updates
    })