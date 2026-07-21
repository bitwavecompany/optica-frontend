import type { Glasses } from "@/types";

export const glassesCatalog: Glasses[] = [
  {
    id: "g001",
    name: "Aviador Clásico",
    brand: "RayStyle",
    category: "sol",
    imagePath: "/lentes/lente-01.png",
    aspectRatio: 2.8,
  },
  {
    id: "g002",
    name: "Wayfarer Urban",
    brand: "RayStyle",
    category: "sol",
    imagePath: "/lentes/lente-02.png",
    aspectRatio: 2.5,
  },
  /*
  {
    id: "g003",
    name: "Redondos Vintage",
    brand: "VisionPlus",
    category: "graduados",
    imagePath: "/lentes/lente-03.png",
    aspectRatio: 2.2,
  },
  {
    id: "g004",
    name: "Cuadrado Moderno",
    brand: "VisionPlus",
    category: "graduados",
    imagePath: "/lentes/lente-04.png",
    aspectRatio: 2.6,
  },
  {
    id: "g005",
    name: "Deportivo Pro",
    brand: "SportVision",
    category: "deportivos",
    imagePath: "/lentes/lente-05.png",
    aspectRatio: 3.0,
  },
  */
];

export const categoriaLabels: Record<string, string> = {
  sol: "Sol",
  graduados: "Graduados",
  deportivos: "Deportivos",
};