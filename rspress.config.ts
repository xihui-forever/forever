import { defineConfig } from 'rspress/config';

export default defineConfig({
  base: '/forever/',
  root: 'docs',
  title: 'Go 全栈技术知识库',
  description: '面试准备 · 学习复习 · 工作参考 · 团队分享',

  // 主题配置
  themeConfig: {
    // 导航栏
    nav: [
      { text: '首页', link: '/' },
      { text: 'Go 语言', link: '/go-basics' },
      { text: '数据库', link: '/mysql' },
      { text: '系统设计', link: '/system-design' },
      { text: '架构', link: '/microservices' },
    ],

    // 侧边栏
    sidebar: {
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
        {
          text: '前端技术',
          items: [
            {
              text: 'JavaScript Promise',
              link: '/js-promise',
            },
          ],
        },
        {
          text: '系统设计',
          items: [
            {
              text: '系统设计',
              link: '/system-design',
            },
          ],
        },
        {
          text: '消息队列',
          items: [
            {
              text: 'Kafka',
              link: '/kafka',
            },
          ],
        },
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
  },
});
