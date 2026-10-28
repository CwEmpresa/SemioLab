"use client"

import React from "react"

import { cn } from "@/lib/utils"

interface AvatarCirclesProps {
  className?: string
  numPeople?: number
  avatarUrls: string[]
  /** Foto opcional, escurecida, atrás do contador "+N". */
  countImageUrl?: string
}

const AvatarCircles = ({
  numPeople,
  className,
  avatarUrls,
  countImageUrl,
}: AvatarCirclesProps) => {
  return (
    <div className={cn("z-10 flex -space-x-4 rtl:space-x-reverse", className)}>
      {avatarUrls.map((url, index) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={index}
          className="h-10 w-10 rounded-full border-2 border-white object-cover dark:border-gray-800"
          src={url}
          width={40}
          height={40}
          alt={`Avatar ${index + 1}`}
        />
      ))}
      {/* O original era um <a href="">, que recarregava a página no clique;
          aqui é só um contador. */}
      <span
        className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-black bg-cover bg-center text-center text-xs font-medium text-white dark:border-gray-800 dark:bg-white dark:text-black"
        style={
          countImageUrl
            ? { backgroundImage: `linear-gradient(rgb(0 0 0 / 0.58), rgb(0 0 0 / 0.58)), url(${countImageUrl})` }
            : undefined
        }
      >
        +{numPeople}
      </span>
    </div>
  )
}

export { AvatarCircles }
