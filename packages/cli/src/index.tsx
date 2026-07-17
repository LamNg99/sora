import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { RootLayout } from './layouts/root-layout';
import { Home } from './screens/home';
import { NewSession } from './screens/new-session';
import { Session } from './screens/session';

process.on('SIGINT', () => {
  process.exit(0);
});

const router = createMemoryRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: 'sessions/new',
        element: <NewSession />,
      },
      {
        path: 'sessions/:id',
        element: <Session />,
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

const renderer = await createCliRenderer();
createRoot(renderer).render(<App />);
