import type { LocaleMessages } from '../types';

const ko: LocaleMessages = {
  nav: {
    dashboard: '대시보드',
    documents: '문서',
    calendar: '캘린더',
    tasks: '작업',
    settings: '설정',
    memory: '메모리',
    skills: '스킬',
    notes: '노트',
  },
  navGroups: {
    workspace: '워크스페이스',
    intelligence: '인텔리전스',
    tools: '도구',
    account: '계정',
  },
  sidebar: {
    newChat: '새 채팅',
    search: '검색',
    today: '오늘',
    yesterday: '어제',
    archive: '보관',
    delete: '삭제',
  },
  chat: {
    placeholder: '{agentName}에게 메시지...',
    send: '보내기',
    retry: '다시 시도',
  },
  settings: {
    language: '언어',
    languageDescription: '워크스페이스 표시 언어를 선택하세요.',
  },
  common: {
    save: '저장',
    cancel: '취소',
    loading: '로딩 중...',
  },
};

export default ko;
