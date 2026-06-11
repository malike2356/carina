import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

interface TaskCountWidgetProps {
  running: number;
  completed: number;
}

export function TaskCountWidget({ running, completed }: TaskCountWidgetProps) {
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#09161e',
        borderRadius: 16,
        padding: 16,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
      clickAction="OPEN_APP"
      clickActionData={{ screen: 'tasks' }}
    >
      <TextWidget
        text="Carina tasks"
        style={{ fontSize: 12, color: '#c9a227', fontWeight: '700' }}
      />
      <FlexWidget style={{ flexDirection: 'row', flexGap: 12 }}>
        <FlexWidget style={{ flex: 1, flexGap: 4 }}>
          <TextWidget text={`${running}`} style={{ fontSize: 28, color: '#f5a623', fontWeight: '700' }} />
          <TextWidget text="Running" style={{ fontSize: 11, color: '#9aa8b0' }} />
        </FlexWidget>
        <FlexWidget style={{ flex: 1, flexGap: 4 }}>
          <TextWidget text={`${completed}`} style={{ fontSize: 28, color: '#3ecf8e', fontWeight: '700' }} />
          <TextWidget text="Done" style={{ fontSize: 11, color: '#9aa8b0' }} />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
