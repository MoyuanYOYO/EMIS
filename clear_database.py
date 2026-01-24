"""
clear_database.py - 清空数据库中的所有数据
"""
import sys
import os
from sqlalchemy import text

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from backend.app import app, db
    from backend import models
    print("✓ 导入成功，开始清空数据库...")
    
except ImportError as e:
    print(f"✗ 导入失败: {e}")
    sys.exit(1)

def clear_database():
    """清空数据库中的所有数据"""
    with app.app_context():
        try:
            print("正在清空数据库...")
            
            # 禁用外键约束（使用text()包裹）
            db.session.execute(text('SET FOREIGN_KEY_CHECKS = 0;'))
            
            # 按依赖关系逆序清空
            tables = [
                ('audit_logs', models.AuditLog),
                ('enrollments', models.Enrollment),
                ('teaching', models.Teaching),
                ('users', models.User),
                ('students', models.Student),
                ('teachers', models.Teacher),
                ('courses', models.Course)
            ]
            
            for table_name, model in tables:
                try:
                    # 使用SQL的TRUNCATE语句（更快且重置自增ID）
                    if table_name in ['audit_logs', 'enrollments', 'teaching']:
                        # 这些表有自增ID，使用TRUNCATE
                        db.session.execute(text(f'TRUNCATE TABLE {table_name};'))
                    else:
                        # 其他表使用DELETE
                        db.session.query(model).delete()
                    
                    print(f"  ✓ {table_name} 表已清空")
                    
                except Exception as e:
                    print(f"  ! {table_name} 表清空失败: {e}")
                    # 尝试使用DELETE作为备选
                    try:
                        db.session.query(model).delete()
                        print(f"  ✓ {table_name} 表已通过DELETE清空")
                    except:
                        pass
            
            # 启用外键约束
            db.session.execute(text('SET FOREIGN_KEY_CHECKS = 1;'))
            
            # 提交事务
            db.session.commit()
            
            print("\n✓ 所有表数据已清空！")
            
        except Exception as e:
            db.session.rollback()
            print(f"✗ 清空数据失败: {e}")
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    clear_database()