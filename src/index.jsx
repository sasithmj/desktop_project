import * as React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import RemortConnect from "./screens/RemortConnect.jsx";

import { HashRouter as Router, Route } from "react-router-dom";

const root = createRoot(document.body);
// root.render(
//   <Router>
//     <div>
//       <main>
//         <Route exact path="/" Component={App} />
//       </main>
//     </div>
//   </Router>
// );
root.render(<App />);
