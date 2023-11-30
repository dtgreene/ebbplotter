import React from 'react';
import { useSnapshot } from 'valtio';

import { appState } from 'src/state/app';
import { MachineTab } from './MachineTab';
import { LayoutTab } from './LayoutTab';
import { AppTab } from './AppTab';
import { Tabs } from '../Tabs';

const tabOptions = ['LAYOUT', 'MACHINE', 'APP'];

export const Sidebar = () => {
  const appSnap = useSnapshot(appState);

  const handleTabChange = (index) => {
    appState.sidebarTab = index;
  };

  const currentTab = appSnap.sidebarTab;

  return (
    <div className="w-[400px] h-full fixed top-0 left-0 bg-zinc-100 dark:bg-zinc-900 __shadow z-10 overflow-y-auto p-8">
      <Tabs
        value={currentTab}
        onChange={handleTabChange}
        options={tabOptions}
      />
      {currentTab === 0 && <LayoutTab />}
      {currentTab === 1 && <MachineTab />}
      {currentTab === 2 && <AppTab />}
    </div>
  );
};
