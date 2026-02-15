import { defineConfig } from 'rspress/config';
import mermaid from 'rspress-plugin-mermaid';

export default defineConfig({
  base: '/forever/',
  root: 'docs',
  title: 'Go 全栈技术知识库',
  description: '面试准备 · 学习复习 · 工作参考 · 团队分享',

  // 主题配置
  themeConfig: {
    // 导航栏（一级目录，保持不变）
    nav: [
      { text: '首页', link: '/' },
      { text: 'Go 语言', link: '/go-basics' },
      { text: '数据库', link: '/mysql' },
      { text: '系统设计', link: '/system-design' },
      { text: '架构', link: '/microservices' },
    ],

    // 侧边栏（根据路径显示对应二级目录）
    sidebar: {
      // 首页
      '/': [
        {
          text: '开始',
          items: [
            {
              text: '项目介绍',
              link: '/README',
            },
          ],
        },
      ],

      // Go 语言相关页面
      '/go-basics': [
        {
          text: 'Go 语言核心',
          items: [
            {
              text: 'Go 基础',
              link: '/go-basics',
            },
            {
              text: 'Go 并发底层',
              link: '/go-concurrency',
            },
            {
              text: 'Go GC',
              link: '/go-gc',
            },
          ],
        },
      ],
      '/go-concurrency': [
        {
          text: 'Go 语言核心',
          items: [
            {
              text: 'Go 基础',
              link: '/go-basics',
            },
            {
              text: 'Go 并发底层',
              link: '/go-concurrency',
            },
            {
              text: 'Go GC',
              link: '/go-gc',
            },
          ],
        },
      ],
      '/go-gc': [
        {
          text: 'Go 语言核心',
          items: [
            {
              text: 'Go 基础',
              link: '/go-basics',
            },
            {
              text: 'Go 并发底层',
              link: '/go-concurrency',
            },
            {
              text: 'Go GC',
              link: '/go-gc',
            },
          ],
        },
      ],

      // 数据库相关页面
      '/mysql': [
        {
          text: '数据库',
          items: [
            {
              text: 'MySQL 深度',
              link: '/mysql',
            },
            {
              text: 'Redis 高级',
              link: '/redis',
            },
            {
              text: 'MongoDB',
              link: '/mongo',
            },
          ],
        },
      ],
      '/redis': [
        {
          text: '数据库',
          items: [
            {
              text: 'MySQL 深度',
              link: '/mysql',
            },
            {
              text: 'Redis 高级',
              link: '/redis',
            },
            {
              text: 'MongoDB',
              link: '/mongo',
            },
          ],
        },
      ],
      '/mongo': [
        {
          text: '数据库',
          items: [
            {
              text: 'MySQL 深度',
              link: '/mysql',
            },
            {
              text: 'Redis 高级',
              link: '/redis',
            },
            {
              text: 'MongoDB',
              link: '/mongo',
            },
          ],
        },
      ],

      // 前端技术
      '/js-promise': [
        {
          text: '前端技术',
          items: [
            {
              text: 'JavaScript Promise',
              link: '/js-promise',
            },
          ],
        },
      ],

      // 系统设计
      '/system-design': [
        {
          text: '系统设计',
          items: [
            {
              text: '系统设计',
              link: '/system-design',
            },
          ],
        },
      ],

      // 消息队列
      '/kafka': [
        {
          text: '消息队列',
          items: [
            {
              text: 'Kafka',
              link: '/kafka',
            },
          ],
        },
      ],

      // 架构与部署
      '/microservices': [
        {
          text: '架构与部署',
          items: [
            {
              text: '微服务架构',
              link: '/microservices',
            },
            {
              text: 'Docker & CI/CD',
              link: '/docker-cicd',
            },
          ],
        },
      ],
      '/docker-cicd': [
        {
          text: '架构与部署',
          items: [
            {
              text: '微服务架构',
              link: '/microservices',
            },
            {
              text: 'Docker & CI/CD',
              link: '/docker-cicd',
            },
          ],
        },
      ],

      // 网络与工具
      '/network': [
        {
          text: '网络与工具',
          items: [
            {
              text: '网络协议',
              link: '/network',
            },
            {
              text: 'ELK 技术栈',
              link: '/elk',
            },
          ],
        },
      ],
      '/elk': [
        {
          text: '网络与工具',
          items: [
            {
              text: '网络协议',
              link: '/network',
            },
            {
              text: 'ELK 技术栈',
              link: '/elk',
            },
          ],
        },
      ],
    },

    // 页脚
    footer: {
      message: '基于 MIT 许可发布',
    },
  },

  // Markdown 配置
  markdown: {
    // 支持代码块语法高亮
    codeHighlighter: 'shiki',
    // 需要禁用 mdxRs 以便使用 remark 插件（包括 mermaid）
    mdxRs: false,
  },
  plugins:[
    mermaid({
      mermaidConfig: {
        theme: 'forest',
      },
    }),
  ]
});
