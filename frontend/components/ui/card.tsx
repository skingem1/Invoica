import * as React from "react";

/**
 * Card component props
 */
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Optional CSS className to apply to the card
   */
  className?: string;
}

/**
 * Card header component props
 */
interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Optional CSS className to apply to the header
   */
  className?: string;
}

/**
 * Card title component props
 */
interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /**
   * Optional CSS className to apply to the title
   */
  className?: string;
}

/**
 * Card description component props
 */
interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  /**
   * Optional CSS className to apply to the description
   */
  className?: string;
}

/**
 * Card content component props
 */
interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Optional CSS className to apply to the content
   */
  className?: string;
}

/**
 * Card footer component props
 */
interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Optional CSS className to apply to the footer
   */
  className?: string;
}

/**
 * A card component that displays content in a styled container
 * 
 * @example
 *
