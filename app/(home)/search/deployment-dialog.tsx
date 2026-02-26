"use client";

import { useEffect, useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Loader2, Check } from "lucide-react";
import { Nurse } from "./search.constant";
import Image from "next/image";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DeploymentDialogProps {
  readonly nurses: readonly Nurse[];
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

interface DeploymentStep {
  label: string;
  status: "complete" | "progress" | "pending";
  progress?: number;
}

const updateDashboardData = async (nurses: readonly Nurse[]) => {
  try {
    console.log("Starting dashboard update for", nurses.length, "nurses");
    const deployedCount = nurses.length;
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

    // Update metrics - increment deployed nurses
    const metricsRes = await fetch(`${baseUrl}/api/metrics`);
    const metricsData = await metricsRes.json();
    console.log("Metrics data:", metricsData);

    if (metricsData.success && metricsData.data) {
      // Update Deployed count
      const deployedMetric = metricsData.data.find(
        (m: any) => m.label === "Deployed",
      );
      console.log("Found deployed metric:", deployedMetric);

      if (deployedMetric) {
        const currentValue = Number.parseInt(deployedMetric.value);
        const newValue = currentValue + deployedCount;
        console.log("Updating deployed from", currentValue, "to", newValue);

        await fetch(`${baseUrl}/api/metrics/${deployedMetric.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: String(newValue) }),
        });
      }

      // Update Nurses Needed count (decrease)
      const neededMetric = metricsData.data.find(
        (m: any) => m.label === "Nurses Needed",
      );
      console.log("Found nurses needed metric:", neededMetric);

      if (neededMetric) {
        const currentValue = Number.parseInt(neededMetric.value);
        const newValue = Math.max(0, currentValue - deployedCount);
        console.log(
          "Updating nurses needed from",
          currentValue,
          "to",
          newValue,
        );

        await fetch(`${baseUrl}/api/metrics/${neededMetric.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: String(newValue) }),
        });
      }
    }

    // Update units - increase staffed percentage based on specialty
    const unitsRes = await fetch(`${baseUrl}/api/units`);
    const unitsData = await unitsRes.json();
    console.log("Units data:", unitsData);

    if (unitsData.success && unitsData.data) {
      // Group nurses by specialty
      const nursesBySpecialty = nurses.reduce(
        (acc, nurse) => {
          const specialty = nurse.specialty;
          acc[specialty] = (acc[specialty] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      console.log("Nurses by specialty:", nursesBySpecialty);

      // Update each unit based on matching specialty
      for (const unit of unitsData.data) {
        const matchingCount = nursesBySpecialty[unit.name] || 0;

        if (matchingCount > 0) {
          const newCurrent = Math.min(
            unit.capacity,
            unit.current + matchingCount,
          );
          const newNeeded = Math.max(0, unit.capacity - newCurrent);
          const newStaffed = Math.round((newCurrent / unit.capacity) * 100);

          console.log(
            `Updating unit ${unit.name}: current ${unit.current} -> ${newCurrent}, needed ${unit.needed} -> ${newNeeded}, staffed ${unit.staffed}% -> ${newStaffed}%`,
          );

          await fetch(`${baseUrl}/api/units/${unit.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              current: newCurrent,
              needed: newNeeded,
              staffed: newStaffed,
            }),
          });
        }
      }
    }

    // Add activity
    console.log("Adding activity");
    const activityRes = await fetch(`${baseUrl}/api/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        time: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        text: `${deployedCount} nurse${
          deployedCount > 1 ? "s" : ""
        } deployed to Memorial Hospital`,
      }),
    });
    const activityResult = await activityRes.json();
    console.log("Activity result:", activityResult);

    console.log("Dashboard update complete");
  } catch (error) {
    console.error("Failed to update dashboard:", error);
  }
};

export function DeploymentDialog({
  nurses,
  open,
  onOpenChange,
}: DeploymentDialogProps) {
  const [steps, setSteps] = useState<DeploymentStep[]>([
    { label: "Generate contracts", status: "complete" },
    { label: "Send to nurses for signature", status: "complete" },
    { label: "Verify licenses", status: "progress", progress: 0 },
    { label: "Run background checks", status: "progress", progress: 0 },
    { label: "Create HR profiles", status: "pending" },
    { label: "Activate badges", status: "pending" },
  ]);
  const [isComplete, setIsComplete] = useState(false);
  const hasUpdatedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setIsComplete(false);
      hasUpdatedRef.current = false;
      setSteps([
        { label: "Generate contracts", status: "complete" },
        { label: "Send to nurses for signature", status: "complete" },
        { label: "Verify licenses", status: "progress", progress: 0 },
        { label: "Run background checks", status: "progress", progress: 0 },
        { label: "Create HR profiles", status: "pending" },
        { label: "Activate badges", status: "pending" },
      ]);
      return;
    }

    const interval = setInterval(() => {
      setSteps((prev) => {
        const updated = [...prev];
        const progressIndex = updated.findIndex((s) => s.status === "progress");

        if (
          progressIndex !== -1 &&
          updated[progressIndex].progress !== undefined
        ) {
          updated[progressIndex].progress! += 5;

          if (updated[progressIndex].progress! >= 100) {
            updated[progressIndex].status = "complete";
            delete updated[progressIndex].progress;

            if (
              progressIndex + 1 < updated.length &&
              updated[progressIndex + 1].status === "pending"
            ) {
              updated[progressIndex + 1].status = "progress";
              updated[progressIndex + 1].progress = 0;
            }
          }
        }

        return updated;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [open]);

  // Separate effect to handle completion
  useEffect(() => {
    const allComplete = steps.every((s) => s.status === "complete");
    if (allComplete && !isComplete && !hasUpdatedRef.current && open) {
      console.log("Deployment complete, calling updateDashboardData once");
      setIsComplete(true);
      hasUpdatedRef.current = true;
      updateDashboardData(nurses);
    }
  }, [steps, isComplete, open, nurses.length]);

  if (nurses.length === 0) return null;

  const today = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`max-w-4xl max-h-[80vh] overflow-y-auto py-2 ${!isComplete ? "[&>button]:hidden" : ""}`}
      >
        {isComplete && (
          <DialogHeader className="border-b  border-sidebar-border">
            {isComplete && (
              <DialogTitle className="text-2xl pb-2 font-normal text-brand-black1">
                Deployment Confirmation
              </DialogTitle>
            )}
          </DialogHeader>
        )}

        {!isComplete ? (
          <div className="space-y-4 py-4 pt-0">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-cyan-600 to-teal-600 rounded-xl p-6 text-white flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-brand-cyan2 rounded-full flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">
                    Deploying {nurses.length} Nurses to Memorial Hospital ICU
                  </h3>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-normal">
                  {Math.round(
                    (steps.filter((s) => s.status === "complete").length /
                      steps.length) *
                      100,
                  )}
                  %
                </div>
                <div className="text-sm opacity-90 font-normal">
                  Match Accuracy
                </div>
              </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-4 gap-6">
              {/* Selected Nurses */}
              <Card className="p-4 col-span-1 border-slate-200">
                <h4 className="font-normal text-xl mb-4 text-brand-black1">
                  Selected Nurses
                </h4>
                <div className="space-y-3">
                  {nurses.map((nurse) => (
                    <div key={nurse.id} className="flex items-center gap-3">
                      <img
                        src={nurse.photo}
                        alt={nurse.name}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                      <span className="text-brand-black2 font-normal text-base">
                        {nurse.name}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Deployment Progress */}
              <Card className="p-4 col-span-3 border-slate-200">
                <h4 className="font-normal text-xl mb-4 text-brand-black1">
                  Deployment - In Progress
                </h4>
                <div className="space-y-4">
                  {steps.map((step, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {step.status === "complete" ? (
                            <CheckCircle2 className="w-6 h-6 text-cyan-600 flex-shrink-0" />
                          ) : step.status === "progress" ? (
                            <Loader2 className="w-6 h-6 text-cyan-600 animate-spin flex-shrink-0" />
                          ) : (
                            <Loader2 className="w-6 h-6 text-orange-500 flex-shrink-0" />
                          )}
                          <span className="text-base text-brand-black4">
                            {step.label}
                          </span>
                        </div>
                        <span
                          className={`text-base font-normal ${
                            step.status === "complete"
                              ? "text-brand-black1"
                              : step.status === "progress"
                                ? "text-brand-black1"
                                : "text-brand-black1"
                          }`}
                        >
                          {step.status === "complete"
                            ? "Completed"
                            : step.status === "progress"
                              ? `${step.progress}%`
                              : "Pending"}
                        </span>
                      </div>
                      <Progress
                        value={
                          step.status === "complete" ? 100 : step.progress || 0
                        }
                        className="h-2"
                      />
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        ) : (
          <div className="space-y-2 py-2">
            <div className="bg-gradient-to-r from-cyan-600 to-teal-600 rounded-xl p-6 text-white flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-brand-cyan2 rounded-full flex items-center justify-center">
                  <Check className="w-5 h-5 " />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">
                    {`${nurses.length} Nurses deployed successfully to Memorial Hospital ICU`}
                  </h3>
                </div>
              </div>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="text-xs font-bold text-brand-black2">
                    <TableRow className="">
                      <TableHead>Nurse</TableHead>
                      <TableHead>CREDENTIALS</TableHead>
                      <TableHead>START DATE</TableHead>
                      <TableHead>SHIFT TIMINGS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nurses.map((nurse) => (
                      <TableRow key={nurse.id} className="hover:bg-slate-50">
                        <TableCell
                          // onClick={() => handleNurseClick(nurse)}
                          className="text-sm font-normal cursor-pointer text-brand-cyan1 hover:text-brand-cyan2"
                        >
                          <div className="relative flex items-center">
                            <Image
                              src={nurse.photo}
                              alt={nurse.name}
                              width={24}
                              height={24}
                              className="object-cover rounded-full w-6 h-6 mr-2"
                            />
                            <span className="text-sm font-normal text-brand-black2">
                              {nurse.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-brand-black2">
                          {`${nurse.credentials}, ${nurse.specialty}`}
                        </TableCell>
                        <TableCell className="text-sm text-brand-black2">
                          {today}
                        </TableCell>
                        <TableCell className=" text-sm text-brand-black2">
                          7a-7p
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
