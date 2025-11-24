#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
REPO_WIKI_DIR=".qoder/repowiki/zh/content"
TEMP_WIKI_DIR=".wiki-temp"
GITHUB_REPO=$(git config --get remote.origin.url | sed 's/\.git$//')

if [ -z "$GITHUB_REPO" ]; then
    echo -e "${RED}错误: 无法获取 GitHub 仓库地址${NC}"
    echo "请确保当前目录是一个 Git 仓库"
    exit 1
fi

# 转换为 wiki URL
WIKI_URL="${GITHUB_REPO}.wiki.git"

echo -e "${GREEN}=== GitHub Wiki 同步工具 ===${NC}"
echo -e "源目录: ${YELLOW}$REPO_WIKI_DIR${NC}"
echo -e "Wiki URL: ${YELLOW}$WIKI_URL${NC}"
echo ""

# 检查源目录是否存在
if [ ! -d "$REPO_WIKI_DIR" ]; then
    echo -e "${RED}错误: 源目录不存在: $REPO_WIKI_DIR${NC}"
    exit 1
fi

# 清理临时目录
if [ -d "$TEMP_WIKI_DIR" ]; then
    echo -e "${YELLOW}清理旧的临时目录...${NC}"
    rm -rf "$TEMP_WIKI_DIR"
fi

# 克隆 Wiki 仓库
echo -e "${GREEN}克隆 Wiki 仓库...${NC}"
if ! git clone "$WIKI_URL" "$TEMP_WIKI_DIR" 2>/dev/null; then
    echo -e "${YELLOW}警告: Wiki 仓库不存在或无法访问，尝试初始化...${NC}"
    mkdir -p "$TEMP_WIKI_DIR"
    cd "$TEMP_WIKI_DIR"
    git init
    git remote add origin "$WIKI_URL"
    cd ..
fi

# 函数: 转换文件名为 Wiki 格式
convert_filename() {
    local filepath="$1"
    local basename=$(basename "$filepath" .md)
    
    # GitHub Wiki 不支持中文文件名，需要进行 URL 编码
    # 但为了可读性，我们保持中文
    echo "$basename"
}

# 函数: 复制并处理文件
process_files() {
    echo -e "${GREEN}处理文件...${NC}"
    
    # 清空 wiki 目录（保留 .git）
    find "$TEMP_WIKI_DIR" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
    
    # 遍历所有 markdown 文件
    find "$REPO_WIKI_DIR" -name "*.md" | while read -r file; do
        # 获取相对路径
        rel_path="${file#$REPO_WIKI_DIR/}"
        
        # 计算目标文件名
        if [[ "$rel_path" == */* ]]; then
            # 包含子目录，将路径转换为文件名（用-分隔）
            wiki_name=$(echo "$rel_path" | sed 's/\.md$//' | sed 's/\//---/g')
        else
            wiki_name=$(basename "$rel_path" .md)
        fi
        
        dest_file="$TEMP_WIKI_DIR/${wiki_name}.md"
        
        echo "  处理: $rel_path -> ${wiki_name}.md"
        
        # 复制文件
        cp "$file" "$dest_file"
    done
    
    # 创建 Home 页面（如果不存在）
    if [ ! -f "$TEMP_WIKI_DIR/Home.md" ] && [ -f "$REPO_WIKI_DIR/项目概述.md" ]; then
        echo "  创建 Home.md"
        cp "$REPO_WIKI_DIR/项目概述.md" "$TEMP_WIKI_DIR/Home.md"
    fi
}

# 处理文件
process_files

# 进入 Wiki 目录
cd "$TEMP_WIKI_DIR"

# 检查是否有变更
if [ -z "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}没有检测到变更，无需同步${NC}"
    cd ..
    rm -rf "$TEMP_WIKI_DIR"
    exit 0
fi

# 显示变更
echo -e "${GREEN}检测到以下变更:${NC}"
git status --short

# 提交变更
echo -e "${GREEN}提交变更...${NC}"
git add .
git commit -m "同步 repowiki 到 GitHub Wiki - $(date '+%Y-%m-%d %H:%M:%S')"

# 推送到远程
echo -e "${GREEN}推送到 GitHub Wiki...${NC}"
if git push origin master 2>/dev/null || git push origin main 2>/dev/null; then
    echo -e "${GREEN}✓ 同步成功！${NC}"
else
    echo -e "${RED}推送失败，请检查权限或手动推送${NC}"
    echo -e "${YELLOW}Wiki 目录位置: $TEMP_WIKI_DIR${NC}"
    cd ..
    exit 1
fi

# 返回原目录
cd ..

# 清理临时目录
echo -e "${GREEN}清理临时文件...${NC}"
rm -rf "$TEMP_WIKI_DIR"

echo -e "${GREEN}=== 同步完成 ===${NC}"
