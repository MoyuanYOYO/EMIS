# test_orm.py - 测试ORM模型
import sys
import os

# 将项目根目录添加到Python路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.app import app, db
from backend import models

with app.app_context():
    print("=== ORM模型测试 ===")
    
    # 1. 测试查询学生
    print("1. 查询所有学生:")
    students = models.Student.query.all()
    for student in students:
        print(f"   - {student.student_id}: {student.name}")
    
    # 2. 测试查询课程
    print("\n2. 查询所有课程:")
    courses = models.Course.query.all()
    for course in courses:
        print(f"   - {course.course_id}: {course.course_name} ({course.credits}学分)")
    
    # 3. 测试查询用户
    print("\n3. 查询用户及其角色:")
    users = models.User.query.all()
    for user in users:
        print(f"   - {user.username}: {user.role}")
    
    # 4. 测试添加新记录（可选）
    print("\n4. 测试添加新学生:")
    try:
        new_student = models.Student(
            student_id='2023004',
            name='赵六',
            id_card_encrypted='test_encrypted_id',
            phone_encrypted='test_encrypted_phone'
        )
        db.session.add(new_student)
        db.session.commit()
        print("   学生添加成功!")
        
        # 删除测试数据
        db.session.delete(new_student)
        db.session.commit()
        print("   测试数据已清理")
    except Exception as e:
        print(f"   添加失败: {e}")
        db.session.rollback()
    
    print("\n=== 测试完成 ===")