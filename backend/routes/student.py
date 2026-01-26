"""
backend/routes/student.py - 学生管理API (RESTful版本)
遵循RESTful API设计原则，提供完整的学生功能接口
"""

from flask import Blueprint, request, jsonify, session
from backend import models
from backend.app import db
from backend.utils.decorators import student_only, login_required
from backend.utils.security import SecurityUtils
from sqlalchemy import or_, and_
import datetime

# 创建蓝图
student_bp = Blueprint('student', __name__)

# ==================== 公共工具函数 ====================

def get_current_student_id():
    """获取当前登录学生ID"""
    return session.get('user_id')

def get_current_student():
    """获取当前学生对象"""
    student_id = get_current_student_id()
    return models.Student.query.get(student_id) if student_id else None

def create_response(success=True, data=None, message=None, error=None, code=200):
    """创建标准API响应"""
    response = {
        'success': success,
        'timestamp': datetime.datetime.now().isoformat()
    }
    
    if data is not None:
        response['data'] = data
    
    if message:
        response['message'] = message
    
    if error:
        response['error'] = error
    
    return jsonify(response), code

def handle_api_error(message, code=400):
    """处理API错误"""
    return create_response(success=False, error=message, code=code)

# ==================== 学生个人信息API ====================

@student_bp.route('/profile', methods=['GET'])
@student_only
def get_profile():
    """获取学生个人信息"""
    try:
        student = get_current_student()
        if not student:
            return handle_api_error('学生信息不存在', 404)
        
        # 解密敏感信息
        profile_data = {
            'student_id': student.student_id,
            'name': student.name,
            'gender': student.gender,
            'birth_date': student.birth_date.isoformat() if student.birth_date else None,
            'id_card': SecurityUtils.decrypt_data(student.id_card_encrypted) if student.id_card_encrypted else None,
            'phone': SecurityUtils.decrypt_data(student.phone_encrypted) if student.phone_encrypted else None,
            'email': student.email,
            'department': student.department,
            'major': student.major,
            'enrollment_year': student.enrollment_year,
            'status': student.status,
            'created_at': student.created_at.isoformat() if student.created_at else None,
            'updated_at': student.updated_at.isoformat() if student.updated_at else None
        }
        
        return create_response(data=profile_data, message='个人信息获取成功')
        
    except Exception as e:
        return handle_api_error(f'获取个人信息失败: {str(e)}', 500)

@student_bp.route('/profile', methods=['POST', 'PUT'])
@student_only
def update_profile():
    """更新学生个人信息（仅允许更新非敏感字段）"""
    try:
        student = get_current_student()
        if not student:
            return handle_api_error('学生信息不存在', 404)
        
        data = request.get_json()
        if not data:
            return handle_api_error('请求数据不能为空', 400)
        
        # 允许更新的字段及其验证规则
        allowed_fields = {
            'email': {
                'type': str,
                'validation': lambda x: '@' in x if x else True,
                'error': '邮箱格式不正确'
            },
            'phone': {
                'type': str,
                'validation': lambda x: len(str(x)) >= 11 if x else True,
                'encrypt': True,
                'error': '手机号格式不正确'
            }
        }
        
        updated_fields = []
        
        for field, config in allowed_fields.items():
            if field in data and data[field] is not None:
                value = data[field]
                
                # 类型检查
                if not isinstance(value, config['type']):
                    return handle_api_error(f'{field}字段类型不正确', 400)
                
                # 验证
                if config.get('validation') and not config['validation'](value):
                    return handle_api_error(config['error'], 400)
                
                # 加密处理（如果需要）
                if config.get('encrypt'):
                    if field == 'phone':
                        student.phone_encrypted = SecurityUtils.encrypt_data(value)
                else:
                    setattr(student, field, value)
                
                updated_fields.append(field)
        
        if not updated_fields:
            return handle_api_error('没有可更新的字段', 400)
        
        student.updated_at = datetime.datetime.now()
        db.session.commit()
        
        # 记录操作日志
        log = models.AuditLog(
            user_id=student.student_id,
            action_type='update_student_profile',
            description=f'学生更新个人信息：{", ".join(updated_fields)}',
            ip_address=request.remote_addr,
            result='success'
        )
        db.session.add(log)
        db.session.commit()
        
        return create_response(message='个人信息更新成功')
        
    except Exception as e:
        db.session.rollback()
        return handle_api_error(f'更新个人信息失败: {str(e)}', 500)

# ==================== 课程管理API ====================

@student_bp.route('/courses', methods=['GET'])
@student_only
def get_available_courses():
    """获取可选课程列表（排除已选课程和已满课程）"""
    try:
        student_id = get_current_student_id()
        
        # 获取当前学期
        latest_course = models.Course.query.order_by(models.Course.semester.desc()).first()
        current_semester = latest_course.semester if latest_course else None
        
        if not current_semester:
            return create_response(data=[], message='当前无可选课程')
        
        # 查询已选课程ID
        enrolled_course_ids = db.session.query(models.Enrollment.course_id)\
            .filter(models.Enrollment.student_id == student_id)\
            .filter(models.Enrollment.status == 'enrolled')\
            .subquery()
        
        # 查询可选课程
        courses = models.Course.query\
            .filter(models.Course.semester == current_semester)\
            .filter(~models.Course.course_id.in_(enrolled_course_ids))\
            .filter(models.Course.current_enrollment < models.Course.capacity)\
            .order_by(models.Course.course_id)\
            .all()
        
        course_list = []
        for course in courses:
            # 获取授课教师信息
            teaching = models.Teaching.query.filter_by(course_id=course.course_id).first()
            teacher = models.Teacher.query.get(teaching.teacher_id) if teaching else None
            
            course_list.append({
                'course_id': course.course_id,
                'course_name': course.course_name,
                'credits': course.credits,
                'hours': course.hours,
                'type': course.type,
                'type_name': {
                    'compulsory': '必修',
                    'elective': '选修',
                    'general': '通识'
                }.get(course.type, course.type),
                'semester': course.semester,
                'description': course.description,
                'capacity': course.capacity,
                'current_enrollment': course.current_enrollment,
                'available_seats': course.capacity - course.current_enrollment,
                'teacher_id': teacher.teacher_id if teacher else None,
                'teacher_name': teacher.name if teacher else '未分配',
                'teacher_title': teacher.title if teacher else None,
                'created_at': course.created_at.isoformat() if course.created_at else None
            })
        
        return create_response(data=course_list, message='可选课程列表获取成功')
        
    except Exception as e:
        return handle_api_error(f'获取课程列表失败: {str(e)}', 500)

@student_bp.route('/courses/<string:course_id>', methods=['GET'])
@student_only
def get_course_detail(course_id):
    """获取课程详情"""
    try:
        course = models.Course.query.get(course_id)
        if not course:
            return handle_api_error('课程不存在', 404)
        
        # 获取授课教师信息
        teaching = models.Teaching.query.filter_by(course_id=course_id).first()
        teacher = models.Teacher.query.get(teaching.teacher_id) if teaching else None
        
        # 获取当前学生是否已选此课程
        student_id = get_current_student_id()
        enrollment = models.Enrollment.query.filter_by(
            student_id=student_id,
            course_id=course_id
        ).first()
        
        course_detail = {
            'course_id': course.course_id,
            'course_name': course.course_name,
            'credits': course.credits,
            'hours': course.hours,
            'type': course.type,
            'type_name': {
                'compulsory': '必修',
                'elective': '选修',
                'general': '通识'
            }.get(course.type, course.type),
            'semester': course.semester,
            'description': course.description,
            'capacity': course.capacity,
            'current_enrollment': course.current_enrollment,
            'available_seats': course.capacity - course.current_enrollment,
            'teacher_info': {
                'teacher_id': teacher.teacher_id if teacher else None,
                'name': teacher.name if teacher else '未分配',
                'title': teacher.title if teacher else None,
                'department': teacher.department if teacher else None,
                'office': teacher.office if teacher else None
            } if teacher else None,
            'teaching_info': {
                'class_no': teaching.class_no if teaching else None,
                'teaching_time': teaching.teaching_time if teaching else None,
                'location': teaching.location if teaching else None
            } if teaching else None,
            'enrollment_status': enrollment.status if enrollment else 'not_enrolled',
            'created_at': course.created_at.isoformat() if course.created_at else None,
            'updated_at': course.updated_at.isoformat() if course.updated_at else None
        }
        
        return create_response(data=course_detail, message='课程详情获取成功')
        
    except Exception as e:
        return handle_api_error(f'获取课程详情失败: {str(e)}', 500)

@student_bp.route('/courses/enrolled', methods=['GET'])
@student_only
def get_enrolled_courses():
    """获取已选课程列表"""
    try:
        student_id = get_current_student_id()
        
        enrollments = models.Enrollment.query\
            .filter_by(student_id=student_id)\
            .filter(models.Enrollment.status.in_(['enrolled', 'completed']))\
            .join(models.Course, models.Enrollment.course_id == models.Course.course_id)\
            .add_entity(models.Course)\
            .order_by(models.Enrollment.enroll_time.desc())\
            .all()
        
        enrolled_courses = []
        for enrollment, course in enrollments:
            # 获取授课教师信息
            teaching = models.Teaching.query.filter_by(course_id=course.course_id).first()
            teacher = models.Teacher.query.get(teaching.teacher_id) if teaching else None
            
            enrolled_courses.append({
                'enrollment_id': enrollment.enrollment_id,
                'course_id': course.course_id,
                'course_name': course.course_name,
                'credits': course.credits,
                'hours': course.hours,
                'type': course.type,
                'type_name': {
                    'compulsory': '必修',
                    'elective': '选修',
                    'general': '通识'
                }.get(course.type, course.type),
                'semester': course.semester,
                'teacher_name': teacher.name if teacher else '未分配',
                'teacher_id': teacher.teacher_id if teacher else None,
                'enroll_time': enrollment.enroll_time.isoformat() if enrollment.enroll_time else None,
                'status': enrollment.status,
                'status_name': {
                    'enrolled': '已选',
                    'completed': '已完成',
                    'dropped': '已退'
                }.get(enrollment.status, enrollment.status),
                'grade': enrollment.grade,
                'regular_score': enrollment.regular_score,
                'final_score': enrollment.final_score,
                'created_at': enrollment.created_at.isoformat() if enrollment.created_at else None
            })
        
        return create_response(data=enrolled_courses, message='已选课程列表获取成功')
        
    except Exception as e:
        return handle_api_error(f'获取已选课程失败: {str(e)}', 500)

@student_bp.route('/courses/<string:course_id>/enroll', methods=['POST'])
@student_only
def enroll_course(course_id):
    """学生选课"""
    try:
        import traceback  # 添加这行
        
        student_id = get_current_student_id()
        
        # 验证课程是否存在
        course = models.Course.query.get(course_id)
        if not course:
            return handle_api_error('课程不存在', 404)
        
        # 检查课程是否已满
        if course.current_enrollment >= course.capacity:
            return handle_api_error('课程已满，无法选择', 400)
        
        # 检查是否已有选课记录（包括已退选的）
        existing_enrollment = models.Enrollment.query.filter_by(
            student_id=student_id,
            course_id=course_id
        ).first()
        
        if existing_enrollment:
            if existing_enrollment.status == 'enrolled':
                return handle_api_error('您已选择此课程', 400)
            elif existing_enrollment.status == 'completed':
                return handle_api_error('此课程已完成，无法重新选择', 400)
            elif existing_enrollment.status == 'dropped':
                # 重新选课：更新现有记录
                existing_enrollment.status = 'enrolled'
                existing_enrollment.enroll_time = datetime.datetime.now()
                existing_enrollment.regular_score = None
                existing_enrollment.final_score = None
                existing_enrollment.grade = None
                existing_enrollment.grade_hash = None
                
                # 重新选课时增加课程人数
                course.current_enrollment += 1
                
                print(f"重新选课：学生 {student_id} 课程 {course_id}，从dropped状态恢复")
        else:
            # 创建新选课记录
            existing_enrollment = models.Enrollment(
                student_id=student_id,
                course_id=course_id,
                status='enrolled',
                enroll_time=datetime.datetime.now()
            )
            db.session.add(existing_enrollment)
            
            # 新选课时增加课程人数
            course.current_enrollment += 1
            
            print(f"新选课：学生 {student_id} 课程 {course_id}")
        
        db.session.commit()
        
        # 记录操作日志
        log = models.AuditLog(
            user_id=student_id,
            action_type='enroll_course',
            description=f'学生选课：{course.course_name} ({course.course_id})',
            ip_address=request.remote_addr,
            result='success'
        )
        db.session.add(log)
        db.session.commit()
        
        return create_response(
            data={
                'enrollment_id': existing_enrollment.enrollment_id,
                'course_id': course.course_id,
                'course_name': course.course_name,
                'enroll_time': existing_enrollment.enroll_time.isoformat(),
                'is_re_enroll': existing_enrollment.status == 'dropped'  # 这里判断是否是重新选课
            },
            message='选课成功'
        )
        
    except Exception as e:
        db.session.rollback()
        print(f"选课失败错误: {str(e)}")
        import traceback
        traceback.print_exc()
        return handle_api_error(f'选课失败: {str(e)}', 500)

@student_bp.route('/enrollments/<int:enrollment_id>/drop', methods=['POST'])
@student_only
def drop_course(enrollment_id):
    """学生退选课程"""
    try:
        student_id = get_current_student_id()
        
        # 验证选课记录
        enrollment = models.Enrollment.query.get(enrollment_id)
        if not enrollment:
            return handle_api_error('选课记录不存在', 404)
        
        if enrollment.student_id != student_id:
            return handle_api_error('无权操作此选课记录', 403)
        
        if enrollment.status != 'enrolled':
            return handle_api_error('当前状态不可退选', 400)
        
        # 更新选课状态
        enrollment.status = 'dropped'
        enrollment.updated_at = datetime.datetime.now()
        
        # 更新课程选课人数
        course = models.Course.query.get(enrollment.course_id)
        if course and course.current_enrollment > 0:
            course.current_enrollment -= 1
        
        db.session.commit()
        
        # 记录操作日志
        log = models.AuditLog(
            user_id=student_id,
            action_type='drop_course',
            description=f'学生退选课程：{course.course_name if course else enrollment.course_id}',
            ip_address=request.remote_addr,
            result='success'
        )
        db.session.add(log)
        db.session.commit()
        
        return create_response(message='退选成功')
        
    except Exception as e:
        db.session.rollback()
        return handle_api_error(f'退选失败: {str(e)}', 500)

# ==================== 成绩管理API ====================

@student_bp.route('/grades', methods=['GET'])
@student_only
def get_all_grades():
    """获取所有课程成绩"""
    try:
        student_id = get_current_student_id()
        
        enrollments = models.Enrollment.query\
            .filter_by(student_id=student_id)\
            .filter(models.Enrollment.status.in_(['completed', 'enrolled']))\
            .join(models.Course, models.Enrollment.course_id == models.Course.course_id)\
            .add_entity(models.Course)\
            .order_by(models.Course.semester.desc(), models.Course.course_id)\
            .all()
        
        grades = []
        total_credits = 0
        total_grade_points = 0
        total_actual_grades = 0
        courses_with_grades = 0
        
        for enrollment, course in enrollments:
            # 验证成绩完整性
            integrity_verified = True
            verification_message = '成绩完整'
            
            if enrollment.grade is not None and enrollment.grade_hash:
                integrity_verified = SecurityUtils.verify_grade_hash(
                    student_id,
                    course.course_id,
                    enrollment.grade,
                    enrollment.grade_hash
                )
                verification_message = '成绩完整性已验证' if integrity_verified else '警告：成绩完整性验证失败'
            elif enrollment.grade is not None:
                verification_message = '成绩未进行完整性保护'
                integrity_verified = False
            else:
                verification_message = '暂无成绩'
            
            grade_info = {
                'course_id': course.course_id,
                'course_name': course.course_name,
                'credits': course.credits,
                'type': course.type,
                'type_name': {
                    'compulsory': '必修',
                    'elective': '选修',
                    'general': '通识'
                }.get(course.type, course.type),
                'semester': course.semester,
                'regular_score': enrollment.regular_score,
                'final_score': enrollment.final_score,
                'grade': enrollment.grade,
                'grade_level': get_grade_level(enrollment.grade) if enrollment.grade else None,
                'status': enrollment.status,
                'status_name': {
                    'enrolled': '在读',
                    'completed': '已修',
                    'dropped': '已退'
                }.get(enrollment.status, enrollment.status),
                'integrity_verified': integrity_verified,
                'verification_message': verification_message,
                'updated_at': enrollment.updated_at.isoformat() if enrollment.updated_at else None
            }
            
            grades.append(grade_info)
            
            # 计算统计信息
            if enrollment.grade is not None:
                total_credits += course.credits
                # 计算绩点×学分（用于GPA）
                gpa_point = calculate_gpa_point(enrollment.grade)
                total_grade_points += gpa_point * course.credits
                # 累加实际分数（用于平均成绩）
                total_actual_grades += enrollment.grade
                courses_with_grades += 1
        

        # 平均成绩和GPA计算
        average_grade = total_actual_grades / courses_with_grades if courses_with_grades > 0 else 0
        gpa = total_grade_points / total_credits if total_credits > 0 else 0

        statistics = {
            'total_courses': len(grades),
            'courses_with_grades': courses_with_grades,
            'total_credits': total_credits,
            'gpa': round(gpa, 2),
            'average_grade': round(average_grade, 2)
        }
        
        return create_response(
            data={
                'grades': grades,
                'statistics': statistics
            },
            message='成绩列表获取成功'
        )
        
    except Exception as e:
        return handle_api_error(f'获取成绩失败: {str(e)}', 500)

@student_bp.route('/grades/<string:course_id>', methods=['GET'])
@student_only
def get_course_grade(course_id):
    """获取特定课程成绩"""
    try:
        student_id = get_current_student_id()
        
        enrollment = models.Enrollment.query.filter_by(
            student_id=student_id,
            course_id=course_id
        ).first()
        
        if not enrollment:
            return handle_api_error('未找到该课程的成绩记录', 404)
        
        course = models.Course.query.get(course_id)
        if not course:
            return handle_api_error('课程不存在', 404)
        
        # 验证成绩完整性
        integrity_verified = True
        verification_message = '成绩完整'
        
        if enrollment.grade is not None and enrollment.grade_hash:
            integrity_verified = SecurityUtils.verify_grade_hash(
                student_id,
                course_id,
                enrollment.grade,
                enrollment.grade_hash
            )
            verification_message = '成绩完整性已验证' if integrity_verified else '警告：成绩完整性验证失败'
        elif enrollment.grade is not None:
            verification_message = '成绩未进行完整性保护'
            integrity_verified = False
        else:
            verification_message = '暂无成绩'
        
        grade_detail = {
            'course_id': course.course_id,
            'course_name': course.course_name,
            'credits': course.credits,
            'semester': course.semester,
            'regular_score': enrollment.regular_score,
            'final_score': enrollment.final_score,
            'grade': enrollment.grade,
            'grade_level': get_grade_level(enrollment.grade) if enrollment.grade else None,
            'status': enrollment.status,
            'status_name': {
                'enrolled': '在读',
                'completed': '已修',
                'dropped': '已退'
            }.get(enrollment.status, enrollment.status),
            'integrity_verified': integrity_verified,
            'verification_message': verification_message,
            'grade_hash': enrollment.grade_hash,
            'enroll_time': enrollment.enroll_time.isoformat() if enrollment.enroll_time else None,
            'updated_at': enrollment.updated_at.isoformat() if enrollment.updated_at else None
        }
        
        return create_response(data=grade_detail, message='课程成绩获取成功')
        
    except Exception as e:
        return handle_api_error(f'获取课程成绩失败: {str(e)}', 500)

@student_bp.route('/grades/statistics', methods=['GET'])
@student_only
def get_grade_statistics():
    """获取成绩统计信息"""
    try:
        student_id = get_current_student_id()
        
        # 获取所有有成绩的课程
        enrollments = models.Enrollment.query\
            .filter_by(student_id=student_id)\
            .filter(models.Enrollment.grade.isnot(None))\
            .join(models.Course, models.Enrollment.course_id == models.Course.course_id)\
            .add_entity(models.Course)\
            .all()
        
        if not enrollments:
            return create_response(
                data={
                    'total_courses': 0,
                    'total_credits': 0,
                    'gpa': 0,
                    'average_grade': 0,
                    'grade_distribution': {},
                    'by_semester': {},
                    'by_type': {}
                },
                message='暂无成绩数据'
            )
        
        # 初始化统计变量
        total_credits = 0
        total_grade_points = 0  # 绩点×学分总和
        total_actual_grades = 0  # 实际分数总和
        grade_distribution = {
            '90-100': 0,
            '80-89': 0,
            '70-79': 0,
            '60-69': 0,
            '0-59': 0
        }
        
        by_semester = {}
        by_type = {
            'compulsory': {'count': 0, 'total_grade': 0, 'total_gpa_points': 0, 'credits': 0},
            'elective': {'count': 0, 'total_grade': 0, 'total_gpa_points': 0, 'credits': 0},
            'general': {'count': 0, 'total_grade': 0, 'total_gpa_points': 0, 'credits': 0}
        }
        
        for enrollment, course in enrollments:
            grade = enrollment.grade
            credits = course.credits
            gpa_point = calculate_gpa_point(grade)  # 计算单课绩点
            
            # 累计算分和绩点
            total_credits += credits
            total_grade_points += grade * credits
            total_actual_grades += grade  # 累加实际分数

            
            # 成绩分布统计
            if grade >= 90:
                grade_distribution['90-100'] += 1
            elif grade >= 80:
                grade_distribution['80-89'] += 1
            elif grade >= 70:
                grade_distribution['70-79'] += 1
            elif grade >= 60:
                grade_distribution['60-69'] += 1
            else:
                grade_distribution['0-59'] += 1
            
            # 按学期统计
            semester = course.semester
            if semester not in by_semester:
                by_semester[semester] = {
                    'count': 0,
                    'total_grade': 0,  # 实际分数总和
                    'total_gpa_points': 0,  # 绩点×学分总和
                    'credits': 0
                }
            by_semester[semester]['count'] += 1
            by_semester[semester]['total_grade'] += grade
            by_semester[semester]['total_gpa_points'] += gpa_point * credits
            by_semester[semester]['credits'] += credits
            
            # 按课程类型统计
            course_type = course.type
            if course_type in by_type:
                by_type[course_type]['count'] += 1
                by_type[course_type]['total_grade'] += grade
                by_type[course_type]['total_gpa_points'] += gpa_point * credits
                by_type[course_type]['credits'] += credits
        
        # 计算平均绩点
        average_grade = total_actual_grades / len(enrollments) if enrollments else 0
        gpa = total_grade_points / total_credits if total_credits > 0 else 0
        
        # 计算各学期平均分
        for semester, data in by_semester.items():
            if data['count'] > 0:
                data['average_grade'] = round(data['total_grade'] / data['count'], 2)
                data['gpa'] = round(data['total_gpa_points'] / data['credits'], 2) if data['credits'] > 0 else 0
        
        # 计算各类型平均分
        for course_type, data in by_type.items():
            if data['count'] > 0:
                data['average_grade'] = round(data['total_grade'] / data['count'], 2)
                data['gpa'] = round(data['total_gpa_points'] / data['credits'], 2) if data['credits'] > 0 else 0
        
        statistics = {
            'total_courses': len(enrollments),
            'total_credits': total_credits,
            'gpa': round(gpa, 2),
            'average_grade': round(average_grade, 2),
            'grade_distribution': grade_distribution,
            'by_semester': by_semester,
            'by_type': by_type
        }
        
        return create_response(data=statistics, message='成绩统计获取成功')
        
    except Exception as e:
        return handle_api_error(f'获取成绩统计失败: {str(e)}', 500)

# ==================== 安全验证API ====================

@student_bp.route('/security/check', methods=['GET'])
@student_only
def security_check():
    """验证学生敏感信息安全性"""
    try:
        student = get_current_student()
        if not student:
            return handle_api_error('学生信息不存在', 404)
        
        # 检查敏感信息是否已加密
        id_card_encrypted = student.id_card_encrypted is not None
        phone_encrypted = student.phone_encrypted is not None
        
        # 尝试解密验证
        id_card_decrypted = False
        phone_decrypted = False
        
        if id_card_encrypted:
            try:
                decrypted = SecurityUtils.decrypt_data(student.id_card_encrypted)
                id_card_decrypted = decrypted is not None and len(decrypted) == 18
            except:
                id_card_decrypted = False
        
        if phone_encrypted:
            try:
                decrypted = SecurityUtils.decrypt_data(student.phone_encrypted)
                phone_decrypted = decrypted is not None and len(decrypted) >= 11
            except:
                phone_decrypted = False
        
        # 检查成绩完整性
        enrollments = models.Enrollment.query.filter_by(student_id=student.student_id).all()
        grade_integrity = []
        
        for enrollment in enrollments:
            if enrollment.grade and enrollment.grade_hash:
                verified = SecurityUtils.verify_grade_hash(
                    student.student_id,
                    enrollment.course_id,
                    enrollment.grade,
                    enrollment.grade_hash
                )
                grade_integrity.append({
                    'course_id': enrollment.course_id,
                    'grade': enrollment.grade,
                    'integrity_verified': verified
                })
        
        security_status = {
            'id_card': {
                'encrypted': id_card_encrypted,
                'decryptable': id_card_decrypted,
                'status': '安全' if id_card_encrypted and id_card_decrypted else '存在风险'
            },
            'phone': {
                'encrypted': phone_encrypted,
                'decryptable': phone_decrypted,
                'status': '安全' if phone_encrypted and phone_decrypted else '存在风险'
            },
            'grade_integrity': {
                'total_grades': len(grade_integrity),
                'verified_grades': len([g for g in grade_integrity if g['integrity_verified']]),
                'details': grade_integrity
            },
            'overall_status': '安全' if (
                id_card_encrypted and id_card_decrypted and 
                phone_encrypted and phone_decrypted and
                all(g['integrity_verified'] for g in grade_integrity if grade_integrity)
            ) else '存在风险'
        }
        
        return create_response(data=security_status, message='安全验证完成')
        
    except Exception as e:
        return handle_api_error(f'安全验证失败: {str(e)}', 500)

# ==================== 辅助函数 ====================

def get_grade_level(grade):
    """根据分数返回等级"""
    if grade is None:
        return None
    
    if grade >= 90:
        return '优秀'
    elif grade >= 80:
        return '良好'
    elif grade >= 70:
        return '中等'
    elif grade >= 60:
        return '及格'
    else:
        return '不及格'

def calculate_gpa_point(grade):
    """根据分数计算绩点"""
    if grade is None or grade < 60:
        return 0.0
    # 60分=1.0，70分=2.0，...，100分=5.0
    gpa_point = 1.0 + (grade - 60) * 0.1
    # 限制最高绩点为5.0
    return min(gpa_point, 5.0)

def is_enrollment_period():
    """检查是否在选课时间内（示例函数，需要根据实际情况实现）"""
    # 这里可以添加具体的选课时间逻辑
    # 例如：检查当前时间是否在学期开始前2周到第4周之间
    return True  # 暂时返回True，实际项目需要具体实现

# ==================== API文档端点 ====================

@student_bp.route('/docs', methods=['GET'])
def api_documentation():
    """API文档"""
    docs = {
        '个人信息': {
            'GET /api/student/profile': '获取学生个人信息',
            'POST/PUT /api/student/profile': '更新学生个人信息'
        },
        '课程管理': {
            'GET /api/student/courses': '获取可选课程列表',
            'GET /api/student/courses/{course_id}': '获取课程详情',
            'GET /api/student/courses/enrolled': '获取已选课程列表',
            'POST /api/student/courses/{course_id}/enroll': '选课',
            'POST /api/student/enrollments/{enrollment_id}/drop': '退课'
        },
        '成绩管理': {
            'GET /api/student/grades': '获取所有成绩',
            'GET /api/student/grades/{course_id}': '获取特定课程成绩',
            'GET /api/student/grades/statistics': '获取成绩统计'
        },
        '安全验证': {
            'GET /api/student/security/check': '验证敏感信息安全'
        }
    }
    
    return create_response(data=docs, message='学生API文档')