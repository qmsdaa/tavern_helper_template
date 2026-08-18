# 一次性迁移：为 150 个场景 YAML 的玩家入口追加 custom（剧情自建）路由，
# 并把 unavailable guard 扩展为排除「带参与方式的剧情自建」。
# 运行：python build_tools/migrate_custom_route.py [--check]
# --check 只校验不写入（幂等校验：已迁移的文件视为通过）。
import glob
import io
import re
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

OLD_UNAVAILABLE = '  # <%_ if (!["hachiman","yukino","yui","laff"].includes(getvar(\'stat_data.current_pov\', { defaults: null }))) { _%>'

CUSTOM_COND = 'getvar(\'stat_data.mode\', { defaults: null }) === "custom" && getvar(\'stat_data.custom_protagonist.participation.track\', { defaults: null }) !== null'
CUSTOM_GUARD = f'  # <%_ if ({CUSTOM_COND}) {{ _%>'
CLOSE_GUARD = '  # <%_ } _%>'

NEW_UNAVAILABLE = (
    '  # <%_ if (!["hachiman","yukino","yui","laff"].includes(getvar(\'stat_data.current_pov\', { defaults: null }))'
    f' && !({CUSTOM_COND})) {{ _%>'
)

TRACK_BULLET = (
    '      - "玩家是自建角色「<%= getvar(\'stat_data.custom_protagonist.name\', { defaults: \'自建角色\' }) %>」，'
    '参与方式轨道：<%= getvar(\'stat_data.custom_protagonist.participation.track\', { defaults: \'\' }) %>'
    '（member=奉仕部第五名部员·classmate=同班旁观者·outsider=场外自由人），'
    '玩家补充：<%= getvar(\'stat_data.custom_protagonist.participation.note\', { defaults: \'\' }) || \'无\' %>"'
)

NORMAL_ROUTE = '\n'.join([
    CUSTOM_GUARD,
    '  custom:',
    '    在场: <%= ["member","classmate"].includes(getvar(\'stat_data.custom_protagonist.participation.track\', { defaults: null })) ? \'true\' : \'false\' %>',
    '    演绎入口:',
    TRACK_BULLET,
    '      - member：开局已被安排进奉仕部，与四人同处事件核心，可接委托、可发言、可被卷入冲突',
    '      - classmate：在公共场合在场边目击事件，不自动进入核心互动；是否被卷入由玩家已声明的行动决定；场景位于私人空间时不代入在场',
    '      - outsider：不在现场，本场只能事后通过传闻、委托或转述得知',
    '      - 事件焦点与NPC动机不因玩家改变；玩家未声明行动时不得替其补写言行',
    CLOSE_GUARD,
])

PRIVATE_ROUTE = '\n'.join([
    CUSTOM_GUARD,
    '  custom:',
    '    在场: false',
    '    演绎入口:',
    TRACK_BULLET,
    '      - 本场景仅有事件焦点角色在场（私密/独占场景），任何参与轨道均不在场：玩家只能事后通过传闻、转述或主动追问得知',
    '      - 事件焦点与NPC动机不因玩家改变；不得替玩家补写；NPC不得主动向玩家泄露本场景经过',
    CLOSE_GUARD,
])


def classify(text, source):
    """返回 'private'（至多 1 个 POV 在场）或 'normal'。"""
    block = re.search(r'^玩家入口:\s*\n((?:[ \t].*\n|\s*\n)+)', text, re.M)
    assert block, f'{source}: 缺少玩家入口块'
    body = block.group(1)
    # 路由体允许 4 空格内容行、空行，以及场景94 laff 路由内嵌的 2 空格特殊POV子块（非 # 开头）
    routes = re.findall(r'^  (?:hachiman|yukino|yui|laff):\s*\n((?:    .*\n|  [^ #\n].*\n|\s*\n)*?)(?=  # <%)', body, re.M)
    assert len(routes) == 4, f'{source}: 应有 4 条 POV 路由，实得 {len(routes)}'
    present = sum(1 for b in routes if re.search(r'^    在场:\s*true\s*$', b, re.M))
    return 'private' if present <= 1 else 'normal'


def migrate(text, source):
    assert text.count(OLD_UNAVAILABLE) == 1, f'{source}: unavailable guard 不是恰好 1 处'
    assert CUSTOM_GUARD not in text, f'{source}: 已存在 custom 路由（重复迁移？）'
    text = text.replace(OLD_UNAVAILABLE, NEW_UNAVAILABLE)

    lines = text.split('\n')
    start = next(i for i, line in enumerate(lines) if line == '玩家入口:')
    end = start + 1
    while end < len(lines) and (lines[end].strip() == '' or lines[end].startswith((' ', '\t'))):
        end += 1
    block = lines[start:end]
    close_indexes = [i for i, line in enumerate(block) if line == CLOSE_GUARD]
    assert len(close_indexes) == 5, f'{source}: 玩家入口应有 5 个 guard 闭合，实得 {len(close_indexes)}'
    insert_at = close_indexes[-1] + 1
    route = PRIVATE_ROUTE if classify(text, source) == 'private' else NORMAL_ROUTE
    block[insert_at:insert_at] = route.split('\n')
    lines[start:end] = block
    return '\n'.join(lines)


def verify(text, source):
    assert text.count(NEW_UNAVAILABLE) == 1, f'{source}: 迁移后 unavailable guard 缺失'
    assert text.count(CUSTOM_GUARD) == 1, f'{source}: 迁移后 custom guard 不是恰好 1 处'
    assert text.count(OLD_UNAVAILABLE) == 0, f'{source}: 旧 unavailable guard 残留'


def main():
    check = '--check' in sys.argv
    files = sorted(glob.glob('世界书/事件/场景*.yaml'))
    assert len(files) == 150, f'场景文件数 {len(files)} != 150'
    stats = {'normal': 0, 'private': 0}
    for f in files:
        text = open(f, encoding='utf-8').read()
        if CUSTOM_GUARD in text:
            verify(text, f)
            stats['private' if '私密/独占场景' in text else 'normal'] += 1
            continue
        assert not check, f'{f}: 尚未迁移'
        kind = classify(text, f)
        text = migrate(text, f)
        verify(text, f)
        open(f, 'w', encoding='utf-8', newline='\n').write(text)
        stats[kind] += 1
    print(('check OK: ' if check else 'migrated: ') + f"150 scenes（normal {stats['normal']} / private {stats['private']}）")


if __name__ == '__main__':
    main()
