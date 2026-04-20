import { WeatherApp } from "@/components/weather-app";

export default function Home() {
  return (
    <main className="flex flex-1 w-full flex-col items-center px-6 py-24">
      <WeatherApp />
    </main>
  );
}
