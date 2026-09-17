import React, { createContext, useContext, useState } from 'react';

const TabBarContext = createContext({
  tabBarVisible: true,
  setTabBarVisible: () => {},
});

export function TabBarProvider({ children }) {
  const [tabBarVisible, setTabBarVisibleState] = useState(true);

  // Guard setter to prevent unnecessary re-renders
  const setTabBarVisible = (visible) => {
    setTabBarVisibleState((prev) => {
      if (prev === visible) return prev;
      return visible;
    });
  };

  return (
    <TabBarContext.Provider value={{ tabBarVisible, setTabBarVisible }}>
      {children}
    </TabBarContext.Provider>
  );
}

export function useTabBar() {
  return useContext(TabBarContext);
}

// Custom hook maintaining static tab bar on scroll
export function useTabBarScroll() {
  const handleScroll = () => {
    // Static navigation bar - remains permanently visible
  };

  return { handleScroll };
}
