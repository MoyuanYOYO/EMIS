"""
run.py - 应用启动入口

调试模式由环境变量 FLASK_DEBUG 控制（默认关闭）。
监听地址由 HOST / PORT 控制（默认 127.0.0.1:5000，不对外网暴露）。
"""
import os

from backend.app import app, db


def _env_flag(name, default=False):
    """从环境变量读取布尔开关，未设置时返回默认值"""
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in ('1', 'true', 'yes', 'on')


if __name__ == '__main__':
    with app.app_context():
        db.create_all()

    debug = _env_flag('FLASK_DEBUG', False)
    host = os.getenv('HOST', '127.0.0.1')
    port = int(os.getenv('PORT', 5000))

    if debug and host not in ('127.0.0.1', 'localhost'):
        print("⚠️  警告：调试模式已开启且监听非本地地址，存在远程代码执行风险！")

    print(f"服务器启动在: http://{host}:{port}  (debug={debug})")
    app.run(debug=debug, host=host, port=port)
