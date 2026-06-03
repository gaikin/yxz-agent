import { Navigate, Route, Routes } from "react-router-dom"
import { AssistantWindowPage } from "../pages/Assistant"
import { ScheduleConfirmationPopup } from "../pages/Popup"
import { TaskWindowPage } from "../windows/task-window"

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/assistant" replace />} />
      <Route path="/assistant" element={<AssistantWindowPage />} />
      <Route path="/popup/schedule-confirmation" element={<ScheduleConfirmationPopup />} />
      <Route path="/agent/popup" element={<ScheduleConfirmationPopup />} />
      <Route path="/yxz/popup" element={<ScheduleConfirmationPopup />} />
      <Route path="/task-window" element={<TaskWindowPage />} />
    </Routes>
  )
}
