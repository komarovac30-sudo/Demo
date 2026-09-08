"use client";
import { useParams } from "next/navigation";
import VisitorDetail from "@/components/VisitorDetail";
export default function AdminVisitorDetailPage(){ const { key } = useParams<{key:string}>(); return <VisitorDetail visitorKey={key} mode="admin"/>; }
