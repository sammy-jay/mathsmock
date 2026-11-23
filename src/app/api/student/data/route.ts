import { databaseErrorResponse, getDatabase, initializeDatabase } from "@/lib/mongodb";
import { getStudentIdentity } from "@/lib/student-auth";
import type { Attempt, TeacherMessage } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const student = await getStudentIdentity(request);
    if (!student) return Response.json({ error: "Enter your name to access your student space." }, { status: 401 });
    const db = await getDatabase();
    await initializeDatabase(db);
    const [attempts, messages] = await Promise.all([
      db.collection<Attempt>("attempts").find({ studentId: student.id, status: "completed" }).project({ _id: 0 }).sort({ createdAt: -1 }).toArray(),
      db.collection<TeacherMessage>("messages").find({ studentId: student.id }).project({ _id: 0 }).sort({ createdAt: 1 }).toArray(),
    ]);
    return Response.json({ attempts, messages });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
