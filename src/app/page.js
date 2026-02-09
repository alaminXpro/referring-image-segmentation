"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Camera,
  HardDrive,
  Download,
  Merge,
  ArrowRight,
  MousePointerClick,
  Scan,
  Crop,
} from "lucide-react";

// --- SVG Sub-components ---

function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 520 280"
      className="w-full max-w-[520px] h-auto"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Referring image segmentation pipeline illustration"
    >
      {/* Photo frame */}
      <rect
        x="20"
        y="20"
        width="240"
        height="240"
        rx="12"
        fill="hsl(var(--muted))"
        stroke="hsl(var(--border))"
        strokeWidth="2"
      />

      {/* Scene objects inside the frame */}
      <rect x="50" y="140" width="60" height="80" rx="4" fill="#94a3b8" />
      <rect x="140" y="100" width="90" height="120" rx="4" fill="#64748b" />
      <circle cx="100" cy="80" r="25" fill="#cbd5e1" />

      {/* Red marking circle - animated */}
      <path
        className="hero-mark-circle"
        d="M 95,55 A 50,50 0 1,1 94.9,55"
        stroke="#ef4444"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />

      {/* Blue segmentation mask overlay */}
      <circle
        className="hero-mask-overlay"
        cx="100"
        cy="80"
        r="25"
        fill="rgba(59,130,246,0.35)"
        opacity="0"
      />

      {/* Cutout group - slides to the right */}
      <g className="hero-cutout-group" opacity="0">
        {/* Arrow from frame to cutout */}
        <path
          d="M 270,80 L 310,80"
          stroke="hsl(var(--muted-foreground))"
          strokeWidth="2"
          strokeDasharray="4,4"
        />
        <polygon
          points="310,75 320,80 310,85"
          fill="hsl(var(--muted-foreground))"
        />

        {/* Cutout card */}
        <rect
          x="330"
          y="40"
          width="80"
          height="80"
          rx="8"
          fill="hsl(var(--card))"
          stroke="hsl(var(--border))"
          strokeWidth="2"
        />
        <circle cx="370" cy="80" r="25" fill="#cbd5e1" />
      </g>

      {/* Step labels */}
      <text
        className="hero-label-mark"
        x="100"
        y="150"
        textAnchor="middle"
        fill="#ef4444"
        fontSize="13"
        fontWeight="600"
        opacity="0"
      >
        Mark
      </text>
      <text
        className="hero-label-segment"
        x="100"
        y="170"
        textAnchor="middle"
        fill="#3b82f6"
        fontSize="13"
        fontWeight="600"
        opacity="0"
      >
        Segment
      </text>
      <text
        className="hero-label-extract"
        x="370"
        y="145"
        textAnchor="middle"
        fill="hsl(var(--foreground))"
        fontSize="13"
        fontWeight="600"
        opacity="0"
      >
        Extract
      </text>
    </svg>
  );
}

function MarkTypeSVG({ type }) {
  const pathData = {
    circle: "M 30,10 A 20,20 0 1,1 29.9,10",
    scribble:
      "M 10,40 Q 15,10 25,30 Q 35,50 45,20 Q 50,10 50,25",
    arrow: "M 10,50 L 50,10 M 35,10 L 50,10 L 50,25",
    check: "M 10,35 L 25,50 L 50,15",
    other:
      "M 10,30 C 20,10 40,10 50,30 C 40,50 20,50 10,30",
  };

  return (
    <svg
      viewBox="0 0 60 60"
      className="w-14 h-14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        className="mark-type-path"
        d={pathData[type]}
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

// --- Main Page ---

export default function LandingPage() {
  const containerRef = useRef(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      // ===== HERO ANIMATION (auto-playing timeline) =====
      const heroTl = gsap.timeline({ delay: 0.5 });

      // Animate the marking circle stroke draw-on
      const markCircle = document.querySelector(".hero-mark-circle");
      if (markCircle) {
        const length = markCircle.getTotalLength();
        gsap.set(markCircle, {
          strokeDasharray: length,
          strokeDashoffset: length,
        });
        heroTl.to(markCircle, {
          strokeDashoffset: 0,
          duration: 1.2,
          ease: "power2.inOut",
        });
      }

      // "Mark" label fades in
      heroTl.to(
        ".hero-label-mark",
        { opacity: 1, duration: 0.4, ease: "power2.out" },
        "-=0.4"
      );

      // Mask overlay fades in
      heroTl.to(".hero-mask-overlay", {
        opacity: 1,
        duration: 0.6,
        ease: "power2.out",
      });

      // "Segment" label fades in
      heroTl.to(
        ".hero-label-segment",
        { opacity: 1, duration: 0.4, ease: "power2.out" },
        "-=0.2"
      );

      // Cutout group slides in
      heroTl.to(".hero-cutout-group", {
        opacity: 1,
        x: 0,
        duration: 0.6,
        ease: "power2.out",
      });

      // "Extract" label fades in
      heroTl.to(
        ".hero-label-extract",
        { opacity: 1, duration: 0.4, ease: "power2.out" },
        "-=0.2"
      );

      // ===== SECTION 2: How It Works — stagger fade-in =====
      gsap.from(".how-step", {
        scrollTrigger: {
          trigger: "#how-it-works",
          start: "top 80%",
        },
        y: 40,
        opacity: 0,
        duration: 0.6,
        stagger: 0.15,
        ease: "power2.out",
      });

      // ===== SECTION 3: Features Grid — stagger fade-in =====
      gsap.from(".feature-card", {
        scrollTrigger: {
          trigger: "#features",
          start: "top 80%",
        },
        y: 40,
        opacity: 0,
        duration: 0.6,
        stagger: 0.12,
        ease: "power2.out",
      });

      // ===== SECTION 4: Mark types — path draw-on =====
      const markPaths = document.querySelectorAll(".mark-type-path");
      markPaths.forEach((p) => {
        const len = p.getTotalLength();
        gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
      });

      gsap.to(".mark-type-path", {
        scrollTrigger: {
          trigger: "#mark-types",
          start: "top 80%",
        },
        strokeDashoffset: 0,
        duration: 0.8,
        stagger: 0.15,
        ease: "power2.inOut",
      });

      gsap.from(".mark-type-label", {
        scrollTrigger: {
          trigger: "#mark-types",
          start: "top 80%",
        },
        y: 10,
        opacity: 0,
        duration: 0.4,
        stagger: 0.15,
        delay: 0.3,
        ease: "power2.out",
      });

      // ===== SECTION 5: Bottom CTA — fade-in =====
      gsap.from(".bottom-cta", {
        scrollTrigger: {
          trigger: ".bottom-cta",
          start: "top 85%",
        },
        y: 30,
        opacity: 0,
        duration: 0.6,
        ease: "power2.out",
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const steps = [
    {
      icon: MousePointerClick,
      title: "Mark",
      description:
        "Draw a circle, scribble, arrow, or check mark around the target object in the image to indicate what you want to segment.",
    },
    {
      icon: Scan,
      title: "Segment",
      description:
        "The ML model interprets your mark and produces a precise segmentation mask of the intended object.",
    },
    {
      icon: Crop,
      title: "Extract",
      description:
        "Get a clean binary mask and cutout of the segmented object, ready for OCR, LLM processing, or downstream tasks.",
    },
  ];

  const features = [
    {
      icon: Camera,
      title: "Capture & Annotate",
      description:
        "Upload images and draw marks with pen tools, stroke styles, colors, and undo support.",
    },
    {
      icon: HardDrive,
      title: "Local-First Storage",
      description:
        "All data lives in your browser's IndexedDB. No server needed — your images never leave your device.",
    },
    {
      icon: Download,
      title: "Export ZIP Datasets",
      description:
        "Export schema-validated datasets as ZIP files, ready for training ML models.",
    },
    {
      icon: Merge,
      title: "Team Merge",
      description:
        "Combine ZIP datasets from multiple contributors into a single unified training set.",
    },
  ];

  const markTypes = [
    { type: "circle", label: "Circle" },
    { type: "scribble", label: "Scribble" },
    { type: "arrow", label: "Arrow" },
    { type: "check", label: "Check" },
    { type: "other", label: "Other" },
  ];

  return (
    <div ref={containerRef} className="space-y-20 pb-12">
      {/* ===== SECTION 1: Hero ===== */}
      <section className="flex flex-col md:flex-row items-center gap-8 pt-8">
        <div className="flex-1 space-y-5">
          <Badge variant="secondary">ML Dataset Tool</Badge>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Build Training Data for Referring Image Segmentation
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed max-w-md">
            Mark an object in an image, generate its segmentation mask, and
            extract a clean cutout — all in your browser. Create high-quality
            datasets for RIS model training.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button asChild>
              <Link href="/capture">
                Start Capturing
                <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <a href="#how-it-works">How It Works</a>
            </Button>
          </div>
        </div>
        <div className="flex-1 flex justify-center">
          <HeroIllustration />
        </div>
      </section>

      <Separator />

      {/* ===== SECTION 2: How It Works ===== */}
      <section id="how-it-works" className="space-y-8 scroll-mt-16">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">How It Works</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Three simple steps from raw image to training-ready data.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map(({ icon: Icon, title, description }, i) => (
            <div
              key={title}
              className="how-step flex flex-col items-center text-center space-y-3"
            >
              <div className="flex items-center justify-center size-14 rounded-full bg-primary/10 text-primary">
                <Icon className="size-6" />
              </div>
              <span className="text-sm font-semibold text-muted-foreground">
                Step {i + 1}
              </span>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <Separator />

      {/* ===== SECTION 3: Features Grid ===== */}
      <section id="features" className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Features</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Everything you need to build and manage RIS datasets.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="feature-card">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10 text-primary shrink-0">
                  <Icon className="size-5" />
                </div>
                <CardTitle className="text-base">{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      {/* ===== SECTION 4: Supported Mark Types ===== */}
      <section id="mark-types" className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">
            Supported Mark Types
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Various stroke types to indicate the target object.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-8">
          {markTypes.map(({ type, label }) => (
            <div
              key={type}
              className="flex flex-col items-center gap-2 text-muted-foreground"
            >
              <MarkTypeSVG type={type} />
              <Badge variant="outline" className="mark-type-label">
                {label}
              </Badge>
            </div>
          ))}
        </div>
      </section>

      <Separator />

      {/* ===== SECTION 5: Bottom CTA ===== */}
      <section className="bottom-cta text-center space-y-5 py-8">
        <h2 className="text-2xl font-bold tracking-tight">
          Ready to Build Your Dataset?
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Start capturing images and creating annotations right away — everything runs locally in your browser.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/capture">
              Go to Capture
              <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/settings">Configure Settings</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
